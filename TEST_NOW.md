# 🎉 Your App is Ready to Test!

## ✅ What's Running

- **Next.js Dev Server:** http://localhost:3000
- **Lambda URL:** Configured ✓
- **Environment:** .env.local loaded ✓

---

## 🧪 Test Steps

### 1. Open Your Browser

Go to: **http://localhost:3000**

You should see:
- "TaskPilot" header
- Task input textarea
- "Prioritize" button
- "View History" link

---

### 2. Enter Test Tasks

Copy and paste these tasks into the textarea:

```
Fix critical login bug
Review pull requests
Update documentation
Plan Q2 roadmap
Refactor authentication module
Write unit tests
Deploy to production
```

---

### 3. Click "Prioritize"

You should see:
- Button changes to "Prioritizing..."
- Wait 2-3 seconds (first request is slower)
- Ranked tasks appear with AI-generated reasons

**Example output:**
```
1. Fix critical login bug
   Critical user experience issue affecting authentication

2. Deploy to production
   Time-sensitive release with dependencies

3. Write unit tests
   Prevents future bugs and improves code quality
```

---

## 🐛 If You See Errors

### Error: "AWS Lambda URL not configured"
**Solution:** Already fixed! Your .env.local is correct.

### Error: "Failed to prioritize tasks"
**Possible causes:**

1. **Lambda code not deployed**
   - Go to AWS Console → Lambda
   - Open `TaskPilotPrioritizer`
   - Make sure the code is pasted and deployed

2. **Bedrock access not enabled**
   - Go to: https://console.aws.amazon.com/bedrock/
   - Click **Model access** (left sidebar)
   - Check if **Amazon Nova Micro** has a green checkmark
   - If not: Click **Manage model access** → Check Nova Micro → Request access

3. **CORS errors** (check browser console - press F12)
   - If you see "CORS policy" error:
   - Go to Lambda → Configuration → Function URL
   - Verify CORS is enabled with `AllowOrigins: *`

### Error: "Internal server error"
**Solution:** Check Lambda logs:
1. AWS Console → Lambda → Monitor tab
2. Click **View CloudWatch logs**
3. Click the latest log stream
4. Look for error messages

---

## 🔍 How to Check Browser Console

1. Press **F12** (or right-click → Inspect)
2. Click **Console** tab
3. Look for red error messages
4. If you see errors, copy them and check the troubleshooting section

---

## ✨ What Should Work

Once everything is set up correctly:

1. ✅ Enter tasks → Click Prioritize
2. ✅ See ranked results in 2-3 seconds
3. ✅ Each task has an AI-generated reason
4. ✅ Tasks are sorted by urgency/impact
5. ✅ No errors in browser console

---

## 📋 Final Checklist

Before testing, verify:

- [ ] Lambda function created in AWS Console
- [ ] Lambda code pasted and deployed
- [ ] Function URL created and copied to .env.local
- [ ] Bedrock model access enabled (Nova Micro)
- [ ] IAM role has correct policies (Bedrock + Lambda + DynamoDB)
- [ ] Next.js dev server restarted after updating .env.local
- [ ] Browser opened to http://localhost:3000

---

## 🎯 Quick Test Command

To test your Lambda directly (without the frontend):

```bash
curl -X POST https://tufnmmafnxvuj64psjlhwysgym0utree.lambda-url.us-east-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d '{"tasks":"Fix bug\nReview code\nUpdate docs"}'
```

Should return JSON with prioritized tasks.

---

## 🚀 Once It Works

After successful test:

1. **Deploy to Vercel** (follow DEPLOYMENT.md)
2. **Write your Builder Center article** (use ARTICLE_CONTENT.md)
3. **Share your demo link!**

---

## 🎉 You're Almost There!

Your setup is complete. Just need to verify:
1. Lambda is deployed with the code
2. Bedrock access is enabled
3. Test at http://localhost:3000

Good luck! 🚀
