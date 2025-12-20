# 🚀 Pre-Deployment Checklist

Use this checklist before deploying to production.

## ✅ Environment Variables

- [ ] `GROQ_API_KEY` - Added to hosting platform
- [ ] `CHAINGPT_API_KEY` - Added (optional backup)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Added (if using analytics)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Added (if using analytics)
- [ ] `PRIVATE_KEY` - Added (if enabling backend deployments)
- [ ] All env vars are in hosting platform's environment settings

## ✅ Supabase Setup (Optional)

- [ ] Supabase project created
- [ ] Database schema (`supabase/schema.sql`) executed
- [ ] Tables verified (10 tables created)
- [ ] RLS policies enabled
- [ ] API credentials copied to `.env.local` and hosting platform

## ✅ Code Quality

- [ ] All TypeScript errors resolved (`npm run build` succeeds)
- [ ] All tests passing (`npm test` shows 45/45 passing)
- [ ] No console errors in browser
- [ ] Templates load correctly
- [ ] File creation works
- [ ] Quick Actions open AI panel

## ✅ Features Testing

- [ ] Landing page loads correctly
- [ ] Studio page loads correctly
- [ ] Monaco editor renders
- [ ] Wallet connects successfully
- [ ] Contract compilation works (with OpenZeppelin imports)
- [ ] Security audit runs
- [ ] AI generation works
- [ ] Template loading works
- [ ] File creation/deletion works
- [ ] File switching works
- [ ] Quick Actions work (Explain, Optimize, Secure, Debug)
- [ ] AI responses appear in panel
- [ ] Terminal shows console output
- [ ] Terminal toggle works
- [ ] Theme toggle (light/dark) works
- [ ] Network toggle (testnet/mainnet) works
- [ ] Deploy button enabled after successful compile
- [ ] Deploy modal shows contract address

## ✅ UI/UX

- [ ] No elements overflow viewport
- [ ] Sidebar doesn't push content off screen
- [ ] AI panel doesn't push content off screen
- [ ] Terminal visible and toggle works
- [ ] Responsive on desktop (1920x1080, 1366x768)
- [ ] All icons render correctly
- [ ] Animations smooth and not janky
- [ ] Loading states show for async operations

## ✅ Security

- [ ] No sensitive keys in client-side code
- [ ] `.env.local` in `.gitignore`
- [ ] `.env` in `.gitignore`
- [ ] Private keys never exposed to frontend
- [ ] API routes validate inputs
- [ ] Supabase RLS policies in place

## ✅ Performance

- [ ] Build completes without errors (`npm run build`)
- [ ] Build size is reasonable (<5MB initial)
- [ ] Monaco editor lazy-loaded
- [ ] No memory leaks (check DevTools)
- [ ] Fast page loads (<2s on good connection)

## ✅ Git & Deployment

- [ ] All changes committed
- [ ] Repository pushed to GitHub/GitLab
- [ ] `.gitignore` includes `.env.local`, `.env`, `node_modules`
- [ ] README.md updated with current info
- [ ] Deployment platform connected (Vercel/Netlify)
- [ ] Environment variables set in platform
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active (HTTPS)

## ✅ Post-Deployment

- [ ] Production URL accessible
- [ ] All features work in production
- [ ] Check browser console for errors
- [ ] Test on different browsers (Chrome, Firefox, Safari)
- [ ] Verify Supabase analytics receiving data (if enabled)
- [ ] Monitor for any runtime errors
- [ ] Set up error tracking (optional: Sentry)

## 📊 Analytics Verification (If Using Supabase)

After deployment, verify data is being tracked:

```sql
-- Check recent events
SELECT * FROM events ORDER BY timestamp DESC LIMIT 10;

-- Check compilations
SELECT * FROM compile_runs ORDER BY compiled_at DESC LIMIT 10;

-- Check user activity
SELECT * FROM users ORDER BY last_active_at DESC LIMIT 10;
```

## 🔧 Common Issues

### Build Fails
- Run `npm install` again
- Clear `.next` folder: `rm -rf .next`
- Check for TypeScript errors: `npm run build`

### Environment Variables Not Working
- Ensure they're prefixed with `NEXT_PUBLIC_` for client-side vars
- Restart dev server after adding env vars
- Check hosting platform's env var syntax

### Supabase Not Working
- Verify URL and keys are correct
- Check Supabase project is active
- Verify schema was run successfully
- Check browser console for Supabase errors

### AI Features Not Working
- Verify at least one AI API key is set
- Check API key is valid and has credits
- Look for 401/403 errors in Network tab

## 📝 Final Notes

- Keep a backup of your `.env.local` file securely
- Document any custom changes for future maintenance
- Set up monitoring (Vercel Analytics, Supabase Logs)
- Consider adding error tracking (Sentry)
- Set up automated backups for Supabase (if using)

## ✨ You're Ready to Deploy!

Once all checkboxes are complete, your app is production-ready!

Deploy command:
```bash
git push origin main
# Vercel/Netlify will auto-deploy
```

Or manually:
```bash
npm run build
npm start
```

---

**Good luck with your deployment! 🚀**
