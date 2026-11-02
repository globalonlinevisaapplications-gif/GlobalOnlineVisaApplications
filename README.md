# globalonlinevisaapplications — setup guide

This is a static website starter for an independent private visa consultancy.
It includes a public enquiry form (Netlify Forms), an optional Supabase-backed
enquiry store, and an admin login/dashboard.

## 1. Publish with GitHub + Netlify

1. Create a new **private or public** GitHub repository named `globalonlinevisaapplications`.
2. Upload all files in this folder to the repository root (not the ZIP file itself).
3. In Netlify, choose **Add new site → Import an existing project**.
4. Connect GitHub and select `globalonlinevisaapplications`.
5. Build command: leave blank. Publish directory: `.` (a single dot).
6. Deploy. Netlify will give you a temporary `*.netlify.app` address.
7. In Netlify, open **Forms** and check that form detection is enabled if prompted. Submit a test enquiry and confirm it appears under Forms.

## 2. Configure the admin dashboard (Supabase)

1. Create a project at https://supabase.com/.
2. Open **SQL Editor**, paste the contents of `supabase-schema.sql`, and run it.
3. Open **Authentication → Users** and add your own administrator user with your email and a strong password. Do not enable public sign-ups.
4. Open **Project Settings → API**. Copy the Project URL and the public publishable/anon key.
5. Open `config.js` in GitHub and replace the empty strings:
   `window.SUPABASE_URL = "https://YOURPROJECT.supabase.co";`
   `window.SUPABASE_ANON_KEY = "YOUR_PUBLIC_ANON_KEY";`
6. Commit the change. Netlify should automatically redeploy.
7. Visit `https://YOUR-SITE.netlify.app/admin.html` and sign in using the admin account you created.

Never put a Supabase `service_role` or secret key in `config.js`, HTML, JavaScript, GitHub, or Netlify public environment variables. The public key is intended for browser use and is restricted by the database Row Level Security policies in the SQL setup.

## 3. How submissions work

The enquiry form sends a submission to Netlify Forms and, when Supabase is configured, also stores it in the `enquiries` table. The custom dashboard reads the Supabase table. Netlify Forms submissions are separately visible in your Netlify site dashboard.

The form deliberately does NOT request passport numbers, passport scans, bank details or passwords. Do not collect identity document uploads until you have designed a secure, access-controlled process and a compliant privacy notice.

## 4. Before going live

- Replace the starter privacy notice with a policy that reflects your real business, jurisdiction, retention period and data processors.
- Add verified business email, phone, address, fees, terms and refund policy.
- Check applicable data protection, consumer protection and immigration-consultancy rules in every market where you operate.
- Do not imply government, embassy or immigration-authority affiliation.
- Do not promise visa approval or use official-looking seals/logos.
- Test the form and admin dashboard from a second browser/device.
- Set a strong unique admin password and enable multi-factor authentication in Supabase if available.

## 5. Troubleshooting

- If Netlify Forms does not detect the form, redeploy after confirming `apply.html` contains `data-netlify="true"` and the hidden `form-name` input.
- If the custom dashboard says Supabase is not configured, check `config.js` and redeploy.
- If admin login works but enquiries do not load, confirm the SQL script ran successfully and that the signed-in account exists in Supabase Authentication.
- If you change the SQL schema, review RLS policies before collecting real customer data.
