# Push power-snapshot-ng image to Amazon ECR
# Run from express-mode/ with Docker Desktop and AWS CLI configured.

param(
    [string]$Region = "us-east-1",
    [string]$RepoName = "power-snapshot-ng"
)

$ErrorActionPreference = "Stop"

$AccountId = aws sts get-caller-identity --query Account --output text
$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$ImageUri = "$Registry/${RepoName}:latest"

Write-Host "Building image..."
docker build -t power-snapshot-ng .

Write-Host "Creating ECR repository (ignore error if it already exists)..."
aws ecr create-repository --repository-name $RepoName --region $Region 2>$null

Write-Host "Logging Docker into ECR..."
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $Registry

Write-Host "Tagging and pushing $ImageUri ..."
docker tag power-snapshot-ng:latest $ImageUri
docker push $ImageUri

Write-Host ""
Write-Host "Done. Image URI:"
Write-Host $ImageUri
