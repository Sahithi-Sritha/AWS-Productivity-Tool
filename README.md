# TaskPilot

AI-powered task prioritization built with Next.js 14 (App Router).

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env.local`:
```
AWS_LAMBDA_URL=your-lambda-function-url-here
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Architecture

- **Frontend**: Single-page React component with textarea input and prioritized results display
- **API**: `/api/prioritize` route proxies requests to AWS Lambda
- **Styling**: Tailwind CSS for minimal, clean UI
- **Error handling**: Loading states and user-friendly error messages

## Expected Lambda Response Format

```json
{
  "prioritizedTasks": [
    {
      "task": "Fix login bug",
      "priority": 1,
      "reason": "Critical user experience issue affecting authentication"
    }
  ]
}
```
