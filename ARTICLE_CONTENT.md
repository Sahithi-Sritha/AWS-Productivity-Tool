# TaskPilot: AWS Builder Center Article Content

## Architecture Diagram Description

**Flow: Top to Bottom**

```
┌─────────────────────────────────────────┐
│         User's Browser                  │
│   (React/Next.js 14 App Router UI)      │
│   • Task input textarea                 │
│   • Prioritize button                   │
│   • Results display                     │
└──────────────────┬──────────────────────┘
                   │ HTTP POST
                   │ /api/prioritize
                   ↓
┌─────────────────────────────────────────┐
│        Vercel (Edge Network)            │
│   Next.js API Route Handler             │
│   • Input validation                    │
│   • Proxy to Lambda                     │
└──────────────────┬──────────────────────┘
                   │ HTTPS POST
                   │ (Function URL)
                   ↓
┌─────────────────────────────────────────┐
│      AWS Lambda (us-east-1)             │
│   Node.js 20.x Handler                  │
│   • Parse task list                     │
│   • Call Bedrock                        │
│   • Retry logic                         │
│   • Save to DynamoDB (optional)         │
└─────────┬────────────────┬──────────────┘
          │                │
          │                │ (optional)
          ↓                ↓
┌──────────────────┐  ┌──────────────────┐
│ Amazon Bedrock   │  │   DynamoDB       │
│                  │  │                  │
│ Nova Micro v1.0  │  │ History Storage  │
│ • Analyze tasks  │  │ PK: userId#date  │
│ • Rank urgency   │  │ SK: timestamp#id │
│ • Generate JSON  │  │                  │
└──────────────────┘  └──────────────────┘
          │                │
          │ JSON Response  │ Saved
          ↓                ↓
┌─────────────────────────────────────────┐
│      Lambda Response Processing         │
│   • Parse Bedrock JSON                  │
│   • Strip markdown if present           │
│   • Fallback to unranked on error       │
└──────────────────┬──────────────────────┘
                   │ JSON
                   ↓
┌─────────────────────────────────────────┐
│        Vercel → Browser                 │
│   Display prioritized tasks with:       │
│   • Numbered ranking (1, 2, 3...)       │
│   • Task text                           │
│   • AI-generated reason (italic)        │
└─────────────────────────────────────────┘
```

**Color coding suggestions for visual:**
- **Blue boxes:** User-facing layer (Browser, Vercel)
- **Orange boxes:** AWS compute (Lambda)
- **Green boxes:** AWS AI/Data services (Bedrock, DynamoDB)
- **Arrows:** Label with request/response types

**Key data flows to highlight:**
1. User input flows down: Tasks (string) → Lambda → Bedrock
2. AI response flows up: JSON array → Lambda → API route → UI
3. Optional persistence: Lambda → DynamoDB (fire-and-forget)

---

## How You Built It

I built TaskPilot as a serverless AI-powered task prioritization tool using Amazon Bedrock's Nova Micro model for intelligent ranking and AWS Lambda for scalable compute. The architecture separates concerns cleanly: Next.js 14 (App Router) handles the UI and client-side interactions, Vercel provides global edge hosting for sub-100ms initial loads, and AWS services handle all the AI heavy lifting. The Lambda function (Node.js 20.x) acts as the orchestration layer, calling Bedrock's InvokeModel API with a structured prompt that instructs Nova Micro to return only valid JSON—an array of tasks ranked by urgency and impact with one-line explanations. 

The biggest challenge was handling Bedrock's occasional tendency to wrap JSON responses in markdown code blocks (triple backticks), which would break JSON.parse(). I solved this with a regex-based extraction pattern that strips markdown formatting before parsing, coupled with a single-retry mechanism: if the first Bedrock call returns malformed output, the Lambda retries once, and if both attempts fail, it falls back to returning the original tasks unranked with an error flag rather than failing completely. This graceful degradation ensures users always get a response, even when the AI misbehaves. For optional persistence, I added DynamoDB with a composite key structure (PK: userId#date, SK: timestamp#uuid) that enables efficient querying of daily history without over-indexing. All DynamoDB writes are fire-and-forget—errors are logged but don't block the response, keeping latency low.

CORS configuration was another pain point: Lambda Function URLs require both the CORS config in AWS (AllowOrigins: "*") and explicit CORS headers in the Lambda response. I also added OPTIONS method handling for preflight requests. The API route in Next.js acts as a thin proxy, primarily there to keep the Lambda URL out of client-side code (though Function URLs are public, hiding the raw endpoint reduces direct exposure). Total cold-start latency is around 2-3 seconds (Bedrock inference dominates), warm-start is under 1 second. Cost per prioritization is roughly $0.0005 (mostly Bedrock tokens at ~150 input + 300 output tokens per request).

---

## What You Learned

This project reinforced three key lessons about building production-ready serverless AI applications. First, **always design for LLM unpredictability**: large language models don't guarantee output format compliance, so defensive parsing (regex cleanup, retries, fallbacks) is mandatory, not optional. My Lambda handler's three-layer safety net (markdown stripping → retry → unranked fallback) means the app degrades gracefully instead of throwing 500 errors. Second, **Function URLs with public auth are underrated for prototypes**: they eliminate API Gateway overhead (cost, complexity, latency) while still providing HTTPS endpoints and CORS support. For this use case, I didn't need API Gateway's throttling or usage plans, so Function URLs cut deployment steps in half. Third, **Bedrock's Nova Micro is remarkably cost-effective for structured tasks**: at $0.000035 per 1K input tokens, it's 10x cheaper than GPT-4 and fast enough (1-2 second inference) for real-time interactions. The tradeoff is occasional formatting quirks, but those are manageable with proper error handling.

I also learned that **DynamoDB's composite keys enable elegant data modeling without GSIs**: using userId#date as the partition key naturally shards history by user and day, making queries cheap (no table scans) while keeping the schema simple. The SK of timestamp#uuid allows sorting within a day without additional indexes. Finally, **Vercel's environment variable scoping (Production/Preview/Development) is cleaner than managing .env files manually**—I can use different Lambda URLs per environment without code changes, which is critical for safe testing before production deploys.

The biggest surprise was how little code this required: the entire Lambda handler is under 150 lines, the Next.js app is ~200 lines total, and the whole stack deploys in under 5 minutes. Serverless + managed AI services compress what used to take days of infrastructure work into a single afternoon of focused development.

---

## AWS Services Used

### Primary AWS Services
- **Amazon Bedrock (Nova Micro v1.0):** Foundation model for task analysis and intelligent prioritization. Processes natural language task lists and generates ranked output with reasoning explanations. Selected for cost-effectiveness ($0.000035/1K input tokens) and low latency (1-2s inference time).

- **AWS Lambda (Node.js 20.x runtime):** Serverless compute layer orchestrating Bedrock API calls, JSON parsing, error handling, and DynamoDB writes. Configured with 256MB memory, 30-second timeout, and public Function URL for direct HTTPS access without API Gateway overhead.

- **Amazon DynamoDB (optional):** NoSQL database for persisting prioritization history. Uses PAY_PER_REQUEST billing mode with composite key design (PK: userId#date, SK: timestamp#uuid) for efficient daily queries without secondary indexes.

### Supporting Infrastructure
- **IAM:** Execution role with `AmazonBedrockFullAccess`, `AmazonDynamoDBFullAccess`, and `AWSLambdaBasicExecutionRole` policies. Least-privilege alternative would use custom policies scoped to specific Bedrock models and DynamoDB table ARNs.

- **CloudWatch Logs:** Automatic logging for Lambda execution traces, Bedrock API errors, and DynamoDB write failures (non-blocking).

### Non-AWS Services (for context)
- **Vercel:** Frontend hosting and edge CDN for the Next.js application. Provides global distribution, automatic HTTPS, and environment variable management. The Next.js API route acts as a lightweight proxy to the Lambda Function URL, keeping the endpoint URL server-side. **Note:** Vercel is used purely for frontend performance and developer experience—all AI logic and data persistence runs on AWS infrastructure.

- **GitHub:** Source code repository for CI/CD integration with Vercel's automatic deployments on git push.

---

## Cost Breakdown (estimated for 1,000 prioritizations)

| Service | Usage | Cost |
|---------|-------|------|
| **Lambda** | 1,000 invocations × 2s avg × 256MB | ~$0.08 |
| **Bedrock Nova Micro** | ~450K tokens (150 input + 300 output per request) | ~$0.05 |
| **DynamoDB** | 1,000 writes (PAY_PER_REQUEST) | ~$0.00125 |
| **Function URL / Data Transfer** | Negligible for <1MB responses | ~$0.01 |
| **CloudWatch Logs** | ~5MB logs | ~$0.00 |
| **Total** | | **~$0.14** |

**Per-request cost:** ~$0.00014 (1.4¢ per 100 prioritizations)

**Notes:**
- Bedrock dominates compute cost but is still 10x cheaper than GPT-4 equivalents
- Lambda cold starts add latency (2-3s) but not cost
- DynamoDB free tier covers first 25GB storage
- Vercel free tier covers hobby projects; paid plans start at $20/mo for production usage

---

## Deployment Checklist for Builder Center Submission

- [ ] GitHub repository is public (or private with reviewer access)
- [ ] Vercel production URL is live and accessible
- [ ] Lambda Function URL is configured in Vercel environment variables
- [ ] No CORS errors in browser console
- [ ] Bedrock model access enabled in AWS Console (Model Access → Enable Nova Micro)
- [ ] DynamoDB table created (optional, but enables history feature)
- [ ] IAM policies attached to Lambda execution role
- [ ] CloudWatch Logs are being written (verify in AWS Console)
- [ ] README.md includes setup instructions
- [ ] DEPLOYMENT.md has step-by-step guide
- [ ] lambda/deploy.md has AWS CLI commands
- [ ] Article includes working demo link (Vercel URL)
- [ ] Screenshots/demo video prepared (optional but recommended)

---

## Sample Article Structure

**Title:** Building TaskPilot: AI-Powered Task Prioritization with Amazon Bedrock and Serverless Architecture

**Introduction (2-3 paragraphs):**
- Problem: Managing task lists is overwhelming without context
- Solution: AI-powered prioritization using Amazon Bedrock Nova Micro
- Tech stack overview: Next.js + Lambda + Bedrock + optional DynamoDB

**Architecture (with diagram):**
- Include the visual diagram based on description above
- Explain data flow from user input to AI response
- Highlight AWS services and their roles

**How You Built It:**
- Use the paragraph above (expand with code snippets if needed)
- Key decisions: Why Lambda Function URLs vs API Gateway, why Nova Micro vs GPT-4
- Challenges: CORS, JSON parsing, graceful degradation

**Code Walkthrough (optional):**
- Lambda handler structure
- Bedrock InvokeModel API call
- Next.js API route proxy pattern
- DynamoDB composite key design

**What You Learned:**
- Use the paragraph above
- Expand on serverless best practices
- Cost optimization insights

**Try It Yourself:**
- Link to GitHub repository
- Link to live demo (Vercel URL)
- Quick deployment guide (1-2 commands)

**Conclusion:**
- Summary of AWS services used
- Cost-effectiveness of serverless AI
- Future enhancements (authentication, categories, collaboration features)

**Resources:**
- [GitHub Repository](https://github.com/YOUR_USERNAME/taskpilot)
- [Live Demo](https://taskpilot-xxxxx.vercel.app)
- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [AWS Lambda Function URLs](https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html)

---

## Screenshots to Include

1. **Landing page:** Clean UI with textarea and Prioritize button
2. **Results view:** Numbered tasks with AI-generated reasons
3. **History panel:** List of past prioritizations (if DynamoDB enabled)
4. **Architecture diagram:** Visual representation from description above
5. **AWS Console:** Bedrock Model Access page showing Nova Micro enabled
6. **Browser DevTools:** Network tab showing successful API call with 200 response
7. **CloudWatch Logs:** Lambda execution logs (redact sensitive data)

---

## Optional Enhancements to Mention

If you want to extend TaskPilot in your article:

- **User authentication:** Integrate AWS Cognito for multi-user support
- **Task categories:** Add tags/labels (work, personal, urgent) for filtering
- **Recurring tasks:** Schedule daily/weekly prioritization via EventBridge
- **Team collaboration:** Share prioritizations with team members
- **Export functionality:** Download as PDF, CSV, or Markdown
- **Custom prompts:** Allow users to define their own prioritization criteria
- **Integration APIs:** Zapier, Slack, Notion webhooks for task import
- **Analytics dashboard:** Track task completion rates over time
- **Mobile-responsive design:** Progressive Web App (PWA) support

---

Good luck with your Builder Center article! 🚀
