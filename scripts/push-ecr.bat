@echo off
setlocal

if "%AWS_REGION%"=="" set AWS_REGION=us-east-1
if "%REPO_NAME%"=="" set REPO_NAME=power-snapshot-ng

for /f %%i in ('aws sts get-caller-identity --query Account --output text') do set AWS_ACCOUNT_ID=%%i

set REGISTRY=%AWS_ACCOUNT_ID%.dkr.ecr.%AWS_REGION%.amazonaws.com
set IMAGE_URI=%REGISTRY%/%REPO_NAME%:latest

echo Building image...
docker build -t power-snapshot-ng .

echo Creating ECR repository (ignore error if it already exists)...
aws ecr create-repository --repository-name %REPO_NAME% --region %AWS_REGION% 2>nul

echo Logging Docker into ECR...
for /f %%p in ('aws ecr get-login-password --region %AWS_REGION%') do docker login --username AWS --password-stdin %REGISTRY%

echo Tagging and pushing %IMAGE_URI% ...
docker tag power-snapshot-ng:latest %IMAGE_URI%
docker push %IMAGE_URI%

echo.
echo Done. Image URI:
echo %IMAGE_URI%
