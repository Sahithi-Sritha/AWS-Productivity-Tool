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
  
  // Nova response structure: { output: { message: { content: [{ text: "..." }] } } }
  const text = responseBody.output?.message?.content?.[0]?.text;
  if (!text) throw new Error("No text in Bedrock response");

  // Extract JSON from potential markdown code blocks
  let jsonText = text.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) jsonText = jsonMatch[1].trim();
  
  const parsed = JSON.parse(jsonText);
  
  // Validate structure
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
  // Handle OPTIONS for CORS preflight
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const path = event.requestContext?.http?.path || event.path || "";
    const method = event.requestContext?.http?.method || event.httpMethod || "POST";

    // GET /history - fetch past prioritizations
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

    // POST / - prioritize tasks
    const { tasks, userId = "guest" } = body;

    if (!tasks || typeof tasks !== "string") {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Invalid input: tasks must be a string" })
      };
    }

    // Split tasks by newlines and filter empty
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
      
      // Retry once
      try {
        console.log("Retrying Bedrock invocation...");
        prioritizedTasks = await invokeBedrock(taskList);
      } catch (retryError) {
        console.error("Retry failed:", retryError);
        hadError = true;
        
        // Fallback: return unranked tasks
        prioritizedTasks = taskList.map((task, index) => ({
          task,
          priority: index + 1,
          reason: "Unable to generate AI ranking"
        }));
      }
    }

    // Save to DynamoDB (best effort, non-blocking)
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
