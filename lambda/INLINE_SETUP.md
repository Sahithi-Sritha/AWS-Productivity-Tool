# Lambda Inline Code Setup (No Upload Needed!)

If you can't find the upload button, you can paste the code directly.

## Step 1: Create Lambda Function in Console

1. Go to: https://console.aws.amazon.com/lambda/
2. Region: **us-east-1** (top-right)
3. Click **Create function**
4. Settings:
   - Name: `TaskPilotPrioritizer`
   - Runtime: **Node.js 20.x**
   - Architecture: **x86_64**
   - Execution role: Select **TaskPilotLambdaRole** (create this first if needed)
5. Click **Create function**

---

## Step 2: Replace Lambda Code

1. In the **Code source** section, you'll see a file tree on the left
2. Click on `index.mjs` (or `index.js`)
3. **DELETE ALL the default code**
4. **PASTE THIS CODE:**

```javascript
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
const TABLE_NAME = "TaskPilotHistory";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

async function invokeBedrock(tasks, retryCount = 0) {
  const prompt = `You are a task prioritization assistant. Analyze these tasks and rank them by urgency and impact.

Tasks:
${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
[
  {"task": "task text", "priority": 1, "reason": "one-line explanation"},
  {"task": "task text", "priority": 2, "reason": "one-line explanation"}
]

Rank by most urgent/impactful first. Keep reasons under 15 words.`;

  const payload = {
    messages: [{ role: "user", content: [{ text: prompt }] }],
    inferenceConfig: { maxTokens: 2048, temperature: 0.7 }
  };

  const command = new InvokeModelCommand({
    modelId: "amazon.nova-micro-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload)
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  const text = responseBody.output?.message?.content?.[0]?.text;
  if (!text) throw new Error("No text in Bedrock response");

  let jsonText = text.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) jsonText = jsonMatch[1].trim();
  
  const parsed = JSON.parse(jsonText);
  
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Invalid response format");
  }
  
  for (const item of parsed) {
    if (!item.task || !item.reason || typeof item.priority !== "number") {
      throw new Error("Missing required fields in response");
    }
  }
  
  return parsed;
}

async function saveToDynamoDB(taskList, prioritizedTasks, userId = "guest") {
  const now = Date.now();
  const date = new Date(now).toISOString().split('T')[0];
  const id = randomUUID();
  
  try {
    await dynamoClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `${userId}#${date}`,
        SK: `${now}#${id}`,
        userId,
        date,
        timestamp: now,
        tasks: taskList,
        prioritizedTasks,
        id
      }
    }));
  } catch (error) {
    console.error("DynamoDB save failed (non-fatal):", error);
  }
}

async function getHistory(userId = "guest", date = null) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const result = await dynamoClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": `${userId}#${targetDate}` },
    ScanIndexForward: false,
    Limit: 10
  }));
  
  return result.Items || [];
}

export async function handler(event) {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const path = event.requestContext?.http?.path || event.path || "";
    const method = event.requestContext?.http?.method || event.httpMethod || "POST";

    if (method === "GET" && path.includes("/history")) {
      const userId = event.queryStringParameters?.userId || "guest";
      const date = event.queryStringParameters?.date || null;
      
      const history = await getHistory(userId, date);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ history })
      };
    }

    const { tasks, userId = "guest" } = body;

    if (!tasks || typeof tasks !== "string") {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Invalid input: tasks must be a string" })
      };
    }

    const taskList = tasks.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    
    if (taskList.length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "No tasks provided" })
      };
    }

    let prioritizedTasks;
    let hadError = false;
    
    try {
      prioritizedTasks = await invokeBedrock(taskList);
    } catch (error) {
      console.error("First attempt failed:", error);
      
      try {
        console.log("Retrying Bedrock invocation...");
        prioritizedTasks = await invokeBedrock(taskList);
      } catch (retryError) {
        console.error("Retry failed:", retryError);
        hadError = true;
        
        prioritizedTasks = taskList.map((task, index) => ({
          task,
          priority: index + 1,
          reason: "Unable to generate AI ranking"
        }));
      }
    }

    await saveToDynamoDB(taskList, prioritizedTasks, userId);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ 
        prioritizedTasks,
        ...(hadError && { error: "AI prioritization failed, returning tasks unranked" })
      })
    };

  } catch (error) {
    console.error("Handler error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
}
```

5. Click **Deploy** button (orange button above the code editor)
6. Wait for "Changes deployed" message

---

## Step 3: Configure Function Settings

1. Click **Configuration** tab (top)
2. Click **General configuration** (left sidebar)
3. Click **Edit**
4. Set:
   - Timeout: **30 seconds**
   - Memory: **256 MB**
5. Click **Save**

---

## Step 4: Create Function URL

1. Still in **Configuration** tab
2. Click **Function URL** (left sidebar)
3. Click **Create function URL**
4. Settings:
   - Auth type: **NONE**
   - Check **Configure cross-origin resource sharing (CORS)**
   - Allow origin: `*`
   - Allow methods: `POST, OPTIONS`
   - Allow headers: `Content-Type`
   - Max age: `86400`
5. Click **Save**
6. **COPY THE FUNCTION URL** (looks like: `https://xyz.lambda-url.us-east-1.on.aws/`)

---

## Step 5: Update .env.local

1. Open: `D:\My projects\aws productivity tool challenge\.env.local`
2. Replace with your Function URL:
   ```
   AWS_LAMBDA_URL=https://your-url-here.lambda-url.us-east-1.on.aws/
   ```
3. Save

---

## Step 6: Enable Bedrock Access

1. Go to: https://console.aws.amazon.com/bedrock/
2. Click **Model access** (left sidebar)
3. Click **Manage model access**
4. Find **Amazon Nova Micro** → Check the box
5. Click **Request model access**
6. Wait 1-2 minutes

---

## Step 7: Test!

1. Restart your dev server:
   ```bash
   npm run dev
   ```
2. Open http://localhost:3000
3. Enter tasks and click Prioritize

**That's it!** No zip upload needed - the AWS SDK libraries are already available in the Lambda runtime.
