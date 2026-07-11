#!/bin/bash
# TaskPilot Lambda Deployment Script
# Run this from the lambda directory: bash deploy-commands.sh

set -e  # Exit on error

echo "=========================================="
echo "TaskPilot Lambda Deployment"
echo "=========================================="
echo ""

# Step 1: Install dependencies
echo "Step 1: Installing Lambda dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Step 2: Create IAM role
echo "Step 2: Creating IAM role..."
aws iam create-role \
  --role-name TaskPilotLambdaRole \
  --assume-role-policy-document file://trust-policy.json

echo "✅ IAM role created"
echo ""

# Step 3: Attach policies
echo "Step 3: Attaching policies to IAM role..."
aws iam attach-role-policy \
  --role-name TaskPilotLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess

aws iam attach-role-policy \
  --role-name TaskPilotLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam attach-role-policy \
  --role-name TaskPilotLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

echo "✅ Policies attached"
echo ""

# Step 4: Get role ARN
echo "Step 4: Getting role ARN..."
ROLE_ARN=$(aws iam get-role --role-name TaskPilotLambdaRole --query 'Role.Arn' --output text)
echo "Role ARN: $ROLE_ARN"
echo ""

# Step 5: Wait for IAM propagation
echo "Step 5: Waiting 15 seconds for IAM role propagation..."
sleep 15
echo "✅ IAM propagation complete"
echo ""

# Step 6: Package Lambda function
echo "Step 6: Packaging Lambda function..."
if [ -f function.zip ]; then
  rm function.zip
fi
zip -r function.zip index.mjs node_modules package.json
echo "✅ Lambda packaged"
echo ""

# Step 7: Create Lambda function
echo "Step 7: Creating Lambda function..."
aws lambda create-function \
  --function-name TaskPilotPrioritizer \
  --runtime nodejs20.x \
  --role "$ROLE_ARN" \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 256 \
  --region us-east-1

echo "✅ Lambda function created"
echo ""

# Step 8: Create Function URL
echo "Step 8: Creating Lambda Function URL..."
FUNCTION_URL=$(aws lambda create-function-url-config \
  --function-name TaskPilotPrioritizer \
  --auth-type NONE \
  --cors AllowOrigins="*",AllowMethods="POST,OPTIONS",AllowHeaders="Content-Type",MaxAge=86400 \
  --region us-east-1 \
  --query 'FunctionUrl' \
  --output text)

echo "✅ Function URL created: $FUNCTION_URL"
echo ""

# Step 9: Add public invoke permission
echo "Step 9: Adding public invoke permission..."
aws lambda add-permission \
  --function-name TaskPilotPrioritizer \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region us-east-1

echo "✅ Public access configured"
echo ""

# Step 10: Create DynamoDB table (optional)
echo "Step 10: Creating DynamoDB table (optional)..."
aws dynamodb create-table \
  --table-name TaskPilotHistory \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1 \
  || echo "⚠️  DynamoDB table may already exist (this is OK)"

echo ""
echo "=========================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "🎉 Your Lambda Function URL:"
echo "$FUNCTION_URL"
echo ""
echo "📝 Next steps:"
echo "1. Copy the URL above"
echo "2. Open ../.env.local"
echo "3. Replace AWS_LAMBDA_URL with the URL above"
echo "4. Restart your Next.js dev server (npm run dev)"
echo "5. Enable Bedrock model access in AWS Console"
echo ""
echo "To enable Bedrock:"
echo "1. Go to: https://console.aws.amazon.com/bedrock"
echo "2. Click 'Model access' (left sidebar)"
echo "3. Click 'Manage model access'"
echo "4. Check 'Amazon Nova Micro'"
echo "5. Click 'Request model access'"
echo ""
