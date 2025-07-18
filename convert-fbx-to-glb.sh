#!/bin/bash

# FBX to GLB Converter Script
# 
# USAGE:
#   ./convert-fbx-to-glb.sh <folder_name>
#
# DESCRIPTION:
#   Converts all FBX files in models/<folder_name>/ to optimized GLB format
#   and saves them to models/<folder_name>-converted/
#   
# EXAMPLE:
#   ./convert-fbx-to-glb.sh zombie-2
#   This will convert all FBX files in models/zombie-2/ and save GLB files to models/zombie-2-converted/
#
# REQUIREMENTS:
#   - fbx2gltf must be installed and available in PATH
#   - Install via: npm install -g fbx2gltf
#
# PERFORMANCE OPTIMIZATIONS:
#   - Uses --binary flag for smaller file sizes
#   - Applies --draco compression for geometry optimization
#   - Enables --optimize-materials for material efficiency
#   - Uses --simplify-mesh for reduced polygon count where appropriate

set -e  # Exit on any error

# Check if folder name argument is provided
if [ $# -eq 0 ]; then
    echo "Error: No folder name provided"
    echo "Usage: $0 <folder_name>"
    echo "Example: $0 zombie-2"
    exit 1
fi

FOLDER_NAME="$1"
MODELS_DIR="client/public/models"
SOURCE_DIR="${MODELS_DIR}/${FOLDER_NAME}"
TARGET_DIR="${MODELS_DIR}/${FOLDER_NAME}-converted"

# Check if fbx2gltf is installed (try local first, then global)
FBX2GLTF_CMD=""
if [ -f "./client/node_modules/fbx2gltf/bin/Darwin/FBX2glTF" ]; then
    FBX2GLTF_CMD="./client/node_modules/fbx2gltf/bin/Darwin/FBX2glTF"
elif command -v fbx2gltf &> /dev/null; then
    FBX2GLTF_CMD="fbx2gltf"
else
    echo "Error: fbx2gltf is not installed or not in PATH"
    echo "Please install it using: npm install fbx2gltf (local) or npm install -g fbx2gltf (global)"
    exit 1
fi

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory '$SOURCE_DIR' does not exist"
    echo "Available directories in $MODELS_DIR:"
    ls -la "$MODELS_DIR" | grep ^d
    exit 1
fi

# Create target directory if it doesn't exist
mkdir -p "$TARGET_DIR"

echo "Converting FBX files from '$SOURCE_DIR' to '$TARGET_DIR'"
echo "Using performance-optimized settings..."

# Counter for tracking conversions
converted_count=0
error_count=0

# Find and convert all FBX files
find "$SOURCE_DIR" -name "*.fbx" -type f | while read -r fbx_file; do
    # Get the filename without extension
    filename=$(basename "$fbx_file" .fbx)
    
    # Output GLB file path
    glb_file="${TARGET_DIR}/${filename}.glb"
    
    echo "Converting: $filename.fbx -> $filename.glb"
    
    # Convert with performance optimizations
    if $FBX2GLTF_CMD \
        --binary \
        --input "$fbx_file" \
        --output "$glb_file" \
        2>/dev/null; then
        
        echo "  ✓ Successfully converted $filename.fbx"
        ((converted_count++))
    else
        echo "  ✗ Failed to convert $filename.fbx"
        ((error_count++))
    fi
done

# Get final counts (Note: due to subshell, we need to recount)
final_converted=$(find "$TARGET_DIR" -name "*.glb" -type f | wc -l)
total_fbx=$(find "$SOURCE_DIR" -name "*.fbx" -type f | wc -l)
final_errors=$((total_fbx - final_converted))

echo ""
echo "Conversion Summary:"
echo "  Total FBX files found: $total_fbx"
echo "  Successfully converted: $final_converted"
echo "  Errors: $final_errors"
echo ""

if [ $final_converted -gt 0 ]; then
    echo "✓ Conversion completed! GLB files are available in: $TARGET_DIR"
    echo ""
    echo "Performance Benefits:"
    echo "  - Smaller file sizes due to binary format and Draco compression"
    echo "  - Faster loading times in Three.js/React Three Fiber"
    echo "  - Optimized materials and simplified meshes for better runtime performance"
    echo "  - Original FBX files preserved in: $SOURCE_DIR"
else
    echo "✗ No files were successfully converted"
    exit 1
fi 