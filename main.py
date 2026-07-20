from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import math
import numpy as np
from scipy.optimize import least_squares

app = FastAPI()

# Geometric calculations
def polar_to_cartesian(radius: float, angle_deg: float) -> tuple[float, float]:
    angle_rad = math.radians(angle_deg)
    x = radius * math.cos(angle_rad)
    y = radius * math.sin(angle_rad)
    return (x, y)

def cartesian_to_polar(x: float, y: float) -> tuple[float, float]:
    distance = math.hypot(x, y)
    angle_rad = math.atan2(y, x)
    angle_deg = math.degrees(angle_rad)
    return distance, angle_deg

def angular_distance(a: float, b: float) -> float:
    diff = abs(a - b)
    return min(diff, 360 - diff)

class Circle:
    def __init__(self, center: tuple[float, float], radius: float, color: str, label: str, reference_angle: float):
        self.center = center
        self.radius = radius
        self.color = color
        self.label = label
        self.reference_angle = reference_angle

    def to_dict(self) -> Dict[str, Any]:
        return {
            "center": {
                "x": float(self.center[0]),
                "y": float(self.center[1])
            },
            "radius": float(self.radius),
            "color": str(self.color),
            "label": str(self.label),
            "reference_angle": float(self.reference_angle)
        }

class BladePositions:
    def trial_angles(self, blade_count: int) -> List[float]:
        if blade_count < 1:
            return []

        spacing = 360.0 / blade_count
        nominal_angles = [0.0, 120.0, 240.0]
        used = set()
        trial_angles = []

        for target in nominal_angles:
            closest_index = None
            min_distance = 370

            for i in range(blade_count):
                blade_angle = i * spacing
                distance = angular_distance(target, blade_angle)
                if distance < min_distance:
                    min_distance = distance
                    closest_index = i

            if closest_index in used:
                available = [i for i in range(blade_count) if i not in used]
                trial_angles.append(available[0] * spacing)
            else:
                trial_angles.append(closest_index * spacing)

            used.add(closest_index)

        while len(trial_angles) < 3:
            available = [i for i in range(blade_count) if i not in used]
            trial_angles.append(available[0] * spacing)
            used.add(available[0])

        return sorted(trial_angles)

class GeometryEngine:
    def __init__(self):
        self.MAX_DISTANCE = 3.5  # Scale multiplier for search bounds
        self.BLADE_START_ANGLE = 90.0  # First blade at vertical (positive Y-axis)

    def solve(self, data: Dict[str, float]) -> Dict[str, Any]:
        """Main solving engine"""
        # Validate inputs
        for key in ["initial_vib", "trial_weight", "red_vib", "blue_vib", "green_vib"]:
            value = data[key]
            if not isinstance(value, (int, float)) or value <= 0:
                raise HTTPException(400, f"{key} must be positive")

        blade_count = int(round(data["blades"]))
        if blade_count < 1:
            raise HTTPException(400, "Blade count must be positive")

        # Generate trial angles with 90° offset for vertical first blade
        blade_spacing = 360.0 / blade_count
        blade_angles = [(self.BLADE_START_ANGLE + i * blade_spacing) % 360 for i in range(blade_count)]

        # Use blade angles for trial positions (nearest blade to nominal 0/120/240)
        nominal_angles = [0.0, 120.0, 240.0]
        used = set()
        trial_angles = []

        for target in nominal_angles:
            closest_index = None
            min_distance = 370

            for i, angle in enumerate(blade_angles):
                distance = angular_distance(target, angle)
                if distance < min_distance:
                    min_distance = distance
                    closest_index = i

            if closest_index in used:
                available = [i for i in range(blade_count) if i not in used]
                trial_angles.append(blade_angles[available[0]])
            else:
                trial_angles.append(blade_angles[closest_index])

            used.add(closest_index)

        while len(trial_angles) < 3:
            available = [i for i in range(blade_count) if i not in used]
            trial_angles.append(blade_angles[available[0]])
            used.add(available[0])

        measured = [data["red_vib"], data["blue_vib"], data["green_vib"]]

        # Create circles centered at origin
        trial_circles = [
            Circle((0.0, 0.0), measured[i],
                  "#c46a1d" if i == 0 else "#148ebd" if i == 1 else "#4caf50",
                  ["RED", "BLUE", "GREEN"][i],
                  trial_angles[i])
            for i in range(3)
        ]

        # Calculate intersection point
        method, residuals = self._graphical_solution(trial_circles)
        if method == "none":
            method, residuals = self.least_squares_fallback(trial_circles)
            return self._fallback_mode(results, fallback_used=True)

        # Calculate correction vector
        x, y = results
        distance = math.hypot(x, y)
        angle = math.degrees(math.atan2(y, x)) % 360

        if distance <= 1e-12:
            raise HTTPException(400, "Graphical solution produced a zero-length vector")

        fit_error = np.sqrt(np.mean([(math.hypot(x - cx, y - cy) - r)**2 for (cx, cy), r in trial_circles]))
        if fit_error > max(5.0, 0.3 * data["initial_vib"]):
            return self.least_squares_fallback(trial_circles)

        # Calculate correction weight
        correction_weight = (data["trial_weight"] * data["initial_vib"]) / distance

        # Find nearest blade position
        nearest_blade = self.find_nearest_blade(blade_angles, angle)

        # Calculate split solution
        split = self._calculate_split(data["trial_weight"], angle, blade_count, blade_angles)

        return {
            "trial_circles": [circle.to_dict() for circle in trial_circles],
            "correction": {
                "weight": round(correction_weight, 2),
                "angle": round(angle, 1)
            },
            "method": method,
            "fit_error": round(fit_error, 4),
            "nearest_blade": nearest_blade["number"],
            "angular_error": round(nearest_blade["error"], 1),
            "blades": blade_count,
            "blade_positions": [{"blade": i + 1, "angle": round(angle, 1)} for i, angle in enumerate(blade_angles)],
            "reference_positions": [{"label": ["RED", "BLUE", "GREEN"][i], "angle": round(trial_angles[i], 1), "point": {"x": 0.0, "y": 0.0}, "color": "#c46a1d" if i == 0 else "#148ebd" if i == 1 else "#4caf50"} for i in range(3)]
        }

    def find_nearest_blade(self, trial_angles: List[float], angle: float) -> Dict[str, Any]:
        """Find closest blade position to the correction angle"""
        blade_spacing = 360.0 / len(trial_angles or [1])
        closest = min([(angular_distance(angle, a), i) for i, a in enumerate(trial_angles)])
        return {
            "number": trial_angles.index(closest[1]) + 1,
            "error": closest[0]
        }

    def _calculate_split(self, total_weight: float, angle: float, blade_count: int) -> Dict[str, Any]:
        """Calculate weight split between available blade positions"""
        bracket_width = 360.0 / blade_count
        clockwise_weight = (total_weight * blade_count) / (math.hypot(math.cos(math.radians(angle)), 
                                                               math.sin(math.radians(angle))))
        return {
            "clockwise_weight": round(clockwise_weight, 2),
            "counterclockwise_weight": round(total_weight - clockwise_weight, 2)
        }

    def _graphical_solution(self, circles: List[Circle]) -> tuple[str, Any]:
        """Primary intersection-based solving method"""
        try:
            # Calculate all pairwise intersections
            intersections = []
            for i in range(len(circles)):
                for j in range(i+1, len(circles)):
                    points = GeometryEngine().find_circle_intersections(circles[i], circles[j])
                    for point in points:
                        intersections.append(point)

            if not intersections:
                return "none", []

            # Filter valid points
            valid_points = [
                p for p in intersections 
                if self._is_valid_intersection(p, circles)
            ]

            if not valid_points:
                return "none", []

            # Select best point using graphical criteria
            best_point = min(valid_points, key=lambda p: max(
                GeometryEngine().circle_distance(p, c)
                for c in circles
            ))

            return "graphical", [GeometryEngine().circle_distance(best_point, c) 
                                for c in circles]

        except Exception as e:
            return "none", []

    def _is_valid_intersection(self, point: tuple[float, float], circles: List[Circle]) -> bool:
        """Check if point lies on or near all circles"""
        for c in circles:
            dx = point[0] - c.center[0]
            dy = point[1] - c.center[1]
            distance = math.hypot(dx, dy)
            if abs(distance - c.radius) > 0.001:
                return False
        return True

    def find_circle_intersections(self, c1: Circle, c2: Circle) -> list:
        """Find intersection points between two circles"""
        x1, y1 = c1.center
        x2, y2 = c2.center
        r1, r2 = c1.radius, c2.radius

        d = math.hypot(x2 - x1, y2 - y1)
        if d > r1 + r2 or d < abs(r1 - r2):
            return []

        a = (r1**2 - r2**2 + d**2) / (2 * d)
        h = math.sqrt(r1**2 - a**2)

        xm = x1 + a*(x2-x1)/d
        ym = y1 + a*(y2-y1)/d

        if h == 0:
            return [(xm, ym)]

        dx = (y2 - y1)/d
        dy = (x1 - x2)/d

        return [
            (xm + h*dx, ym + h*dy),
            (xm - h*dx, ym - h*dy)
        ]

    def least_squares_fallback(self, circles: List[Circle]) -> tuple[str, Any]:
        """Fallback least-squares minimization"""
        def objective(p):
            x, y = p
            return sum((math.hypot(x - cx, y - cy) - r)**2 for (cx, cy), r in circles)

        result = least_squares(objective, x0=[0, 0], bounds=(0, math.inf))
        
        if not result.success:
            return "none", [result.fun]
        
        residuals = [math.hypot(result.x[0] - cx, result.x[1] - cy) - r for (cx, cy), r in circles]
        return "least_squares", residuals

    def circle_distance(self, point: tuple[float, float], circle: Circle) -> float:
        """Calculate distance between point and circle"""
        return math.hypot(point[0] - circle.center[0], point[1] - circle.center[1]) - circle.radius
