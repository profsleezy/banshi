# Granting User Access

This is the manual paid-access workflow for the MVP.

## Normal Flow

1. The customer signs up on the site.
2. Open Supabase.
3. Go to SQL Editor.
4. Run this:

```sql
SELECT * FROM public.grant_user_access_by_email('customer@email.com', 'agency');
```

5. Tell the customer to refresh the dashboard.

## Plans

Use one of these plan keys:

```text
starter  = 5 clients
agency   = 25 clients
command  = 75 clients
founder  = 150 clients / custom desk
```

## Trial Access

This grants Agency access for 14 days:

```sql
SELECT * FROM public.grant_user_access_by_email('customer@email.com', 'agency', NULL, 14);
```

## Custom Client Limit

This grants Custom Desk access with 150 clients:

```sql
SELECT * FROM public.grant_user_access_by_email('customer@email.com', 'founder', 150);
```

## Remove Access

This keeps the account but locks the workspace:

```sql
SELECT * FROM public.suspend_user_access_by_email('customer@email.com');
```

## If The Email Does Not Work

The customer has not signed up yet, or they used a different email.

Find recent users:

```sql
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 20;
```

