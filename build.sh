# Define variables
DOCKER_USERNAME="tylerthecoder"
IMAGE_NAME="tt-services"
TAG="latest"

# Build the Docker image
echo "Building Docker image..."
docker build -t $DOCKER_USERNAME/$IMAGE_NAME:$TAG .