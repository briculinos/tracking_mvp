import math
from typing import Tuple


def point_in_rectangle(
    px: float, py: float,
    x1: float, y1: float,
    x2: float, y2: float
) -> bool:
    """Check if a point is inside a rectangle"""
    min_x, max_x = min(x1, x2), max(x1, x2)
    min_y, max_y = min(y1, y2), max(y1, y2)
    return min_x <= px <= max_x and min_y <= py <= max_y


def distance(x1: float, y1: float, x2: float, y2: float) -> float:
    """Calculate Euclidean distance between two points"""
    return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)


def data_to_image_coords(
    data_x: float,
    data_y: float,
    data_min_x: float,
    data_max_x: float,
    data_min_y: float,
    data_max_y: float,
    image_width: int,
    image_height: int
) -> Tuple[int, int]:
    """
    Convert data coordinates (meters) to image pixel coordinates.

    The y-axis is typically flipped for image coordinates
    (0 at top, increasing downward).
    """
    # Normalize to 0-1 range
    norm_x = (data_x - data_min_x) / (data_max_x - data_min_x) if data_max_x != data_min_x else 0
    norm_y = (data_y - data_min_y) / (data_max_y - data_min_y) if data_max_y != data_min_y else 0

    # Convert to pixel coordinates
    # Note: y is flipped for image coordinates
    pixel_x = int(norm_x * image_width)
    pixel_y = int((1 - norm_y) * image_height)

    return pixel_x, pixel_y


def image_to_data_coords(
    pixel_x: int,
    pixel_y: int,
    data_min_x: float,
    data_max_x: float,
    data_min_y: float,
    data_max_y: float,
    image_width: int,
    image_height: int
) -> Tuple[float, float]:
    """
    Convert image pixel coordinates to data coordinates (meters).
    """
    # Normalize pixel to 0-1 range
    norm_x = pixel_x / image_width if image_width > 0 else 0
    norm_y = 1 - (pixel_y / image_height) if image_height > 0 else 0  # Flip y

    # Convert to data coordinates
    data_x = data_min_x + norm_x * (data_max_x - data_min_x)
    data_y = data_min_y + norm_y * (data_max_y - data_min_y)

    return data_x, data_y


def snap_to_grid(value: float, grid_size: float) -> float:
    """Snap a value to the nearest grid cell center"""
    return math.floor(value / grid_size) * grid_size + (grid_size / 2)
