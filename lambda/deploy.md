# TaskPilot Lambda Deployment Guide

## Prerequisites
- AWS CLI installed and configured with credentials
- Node.js 18+ installed locally

## Step 1: Package the Lambda

```bash
cd lambda
npm install
zip -r function.zip index.mjs node_modules package.json
```

**Windows (PowerShell):**
```powershell
cd lambda
npm install
Compress-Archive -Path index.mjs,node_modules,package.json -DestinationPath function.zip -Force
```

## Step 2: Create IAM Role for Lambda

```bash
# Create trust policy
cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the role
aws iam create-role \
  --role-name TaskPilotLambdaRole \
  --assume-role-policy-document file://trust-policy.json

# Attach Bedrock access policy
aws iam attach-role-policy \
  --role-name TaskPilotLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess

# Attach basic Lambda execution policy (for CloudWatch logs)
aws iam attach-role-policy \
  --role-name TaskPilotLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Attach DynamoDB access policy (for persistence)
aws iam attach-role-policy \
  --role-name TaskPilotLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

# Get the role ARN (needed for next step)
aws iam get-role --role-name TaskPilotLambdaRole --query 'Role.Arn' --output text
```

**Note:** Wait 10-15 seconds after creating the role before proceeding to allow IAM propagation.

## Step 2.5: Create DynamoDB Table (Optional - for persistence)

```bash
aws dynamodb create-table \
  --table-name TaskPilotHistory \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

**Table Schema:**
- **PK:** `userId#YYYY-MM-DD` (e.g., `guest#2026-07-11`)
- **SK:** `timestamp#uuid` (e.g., `1720742400000#abc123`)
- **Attributes:** tasks (list), prioritizedTasks (list), timestamp (number)

## Step 3: Create Lambda Function

Replace `<ROLE-ARN>` with the ARN from the previous step:

```bash
aws lambda create-function \
  --function-name TaskPilotPrioritizer \
  --runtime nodejs20.x \
  --role <ROLE-ARN> \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 256 \
  --region us-east-1
```

## Step 4: Create Public Function URL

```bash
# Create the Function URL
aws lambda create-function-url-config \
  --function-name TaskPilotPrioritizer \
  --auth-type NONE \
  --cors '{
    "AllowOrigins": ["*"],
    "AllowMethods": ["POST", "OPTIONS"],
    "AllowHeaders": ["Content-Type"],
    "MaxAge": 86400
  }' \
  --region us-east-1

# Add public invoke permission
aws lambda add-permission \
  --function-name TaskPilotPrioritizer \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region us-east-1
```

**The command output will include your Function URL** - save this for your `.env.local` file.

## Step 5: Update Your Next.js App

Copy the Function URL from the previous command output and update `.env.local`:

```bash
AWS_LAMBDA_URL=https://your-unique-id.lambda-url.us-east-1.on.aws/
```

## Step 6: Test the Lambda

```bash
aws lambda invoke \
  --function-name TaskPilotPrioritizer \
  --payload '{"body":"{\"tasks\":\"Fix login bug\\nReview PRs\\nUpdate docs\"}"}' \
  --region us-east-1 \
  response.json

cat response.json
```

## Update Lambda Code (After Changes)

```bash
# Re-package
zip -r function.zip index.mjs node_modules package.json

# Update function
aws lambda update-function-code \
  --function-name TaskPilotPrioritizer \
  --zip-file fileb://function.zip \
  --region us-east-1
```

## Cleanup (When Done)

```bash
# Delete Function URL config
aws lambda delete-function-url-config \
  --function-name TaskPilotPrioritizer \
  --region us-east-1

# Delete Lambda function
aws lambda delete-function \
  --function-name TaskPilotPrioritizer \
  --region us-east-1

# Detach policies
aws iam detach-role-policy \
  --role-name TaskPilotLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess

aws iam detach-role-policy \
  --role-name TaskPilotLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam detach-role-policy \
  --role-name TaskPilotLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

# Delete DynamoDB table
aws dynamodb delete-table \
  --table-name TaskPilotHistory \
  --region us-east-1

# Delete IAM role
aws iam delete-role --role-name TaskPilotLambdaRole
```

## Troubleshooting

**"Bedrock access denied":**
- Verify the IAM role has AmazonBedrockFullAccess attached
- Check if Nova model is available in us-east-1 region
- Ensure you have model access enabled in Bedrock console

**"Function URL not working":**
- Verify public invoke permission was added
- Check CORS configuration includes your origin
- Test with curl: `curl -X POST <FUNCTION-URL> -H "Content-Type: application/json" -d '{"tasks":"test task"}'`

**"Invalid JSON from model":**
- The handler includes retry logic and fallback
- Check CloudWatch Logs for detailed error messages
- Nova-micro sometimes wraps JSON in markdown - handler strips this

## Cost Estimate

- Lambda: ~$0.20 per 1M requests + $0.0000166667 per GB-second
- Bedrock Nova Micro: ~$0.000035 per 1K input tokens, ~$0.00014 per 1K output tokens
- **Estimated cost for 1000 prioritizations: < $0.50**
