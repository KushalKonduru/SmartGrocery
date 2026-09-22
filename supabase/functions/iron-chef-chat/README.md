# IronChef AI Cooking Assistant Setup

This guide will help you set up the IronChef AI cooking assistant in your Supabase project.

## Prerequisites

1. Supabase CLI installed
2. A Lovable AI API key
3. Supabase project initialized

## Setup Steps

1. First, login to Supabase CLI:
```bash
supabase login
```

2. Link your project (replace with your project reference):
```bash
supabase link --project-ref fylsaezgqfjkdyikhiqj
```

3. Set the Lovable API key as a secret:
```bash
supabase secrets set LOVABLE_API_KEY=your_actual_api_key
```

4. Deploy the edge function:
```bash
supabase functions deploy iron-chef-chat
```

## Testing the Function

You can test the function using the Supabase Dashboard or via curl:

```bash
curl -L -X POST 'https://fylsaezgqfjkdyikhiqj.supabase.co/functions/v1/iron-chef-chat' \
-H 'Authorization: Bearer your-anon-key' \
-H 'Content-Type: application/json' \
--data '{
  "messages": [
    {
      "role": "user",
      "content": "Can you give me a simple pasta recipe?"
    }
  ]
}'
```

## Troubleshooting

1. If you see "LOVABLE_API_KEY is not configured":
   - Make sure you've set the secret correctly
   - Verify the secret is deployed with `supabase secrets list`

2. If you get authentication errors:
   - Ensure you're passing the correct Supabase JWT token
   - Check that the user is authenticated if using `verify_jwt = true`

3. For "AI Gateway error":
   - Verify your Lovable AI API key is valid
   - Check the response status code and error message

## Frontend Integration

The React component will automatically connect to your edge function. Make sure:

1. Your Supabase client is configured correctly
2. Users are authenticated if required
3. Error handling is in place for failed requests

## Environment Variables

Required environment variables:
- `LOVABLE_API_KEY`: Your Lovable AI API key

Optional configuration in `config.toml`:
```toml
[functions.iron-chef-chat]
verify_jwt = true  # Set to false if you want to allow anonymous access
```