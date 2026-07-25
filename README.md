# Balancing_Sw Project README

## Project Overview
This project implements a graphical balancing simulation for industrial impellers/fans, replicating the graphical interface and methodology of RotorZone. The application maintains the original mathematical balancing calculations while refining the visual representation to match RotorZone's interface requirements.

Key features include:
- Blade positioning aligned with RotorZone's vertical-first (90°) configuration
- Clockwise blade numbering convention matching RotorZone's display
- Trial position snapping to blade geometry similar to RotorZone
- Unchanged mathematical foundation for balance calculations
- Interactive correction marker with live weight/angle updates

## Features
- Interactive 2D polar coordinate visualization
- Drag-and-drop correction weight placement
- Blade angle visualization with labels
- Trial position angle display
- Balance calculation metrics (weight, angle, fit error)
- Split-weight solution calculation
- Responsive canvas rendering

## Getting Started
### Prerequisites
- Browser with JavaScript enabled
- Local Python environment (for backend processing)

### Setup
1. Clone repository
2. Install dependencies (if any):
   ```bash
   # No specific dependencies required for frontend
   # Python dependencies (if running backend): 
   #   pip install flask numpy (if backend is implemented)
