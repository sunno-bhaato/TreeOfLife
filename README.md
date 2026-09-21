# TreeOfLife · वंश वृक्ष

A family-tree website. Visitors see a Hindi (Devanagari) interface, can zoom, pan, search, drag names around
(nothing they move is saved) and tap a person to open a profile card. Admins sign in at `/admin` (English) to add,
edit, delete people and to draw or remove the arrows that join them.

Stack: Next.js 14 (App Router) · React Flow (`@xyflow/react`) · Supabase (database, photo storage, admin login) · Vercel.

## 1. Set up Supabase (free tier is enough)

1. Create a project at https://supabase.com.
2. **SQL Editor** → paste all of `supabase/schema.sql` → Run.
3. In the same editor run (with your own email):
   `insert into public.admins (email) values ('you@example.com');`
4. **Authentication → Users → Add user** → your email + a password (tick *Auto Confirm User*).
5. Recommended: **Authentication → Providers → Email** → turn off *Allow new users to sign up*.
6. Optional: run `supabase/seed.sql` for a small sample family.
7. **Project Settings → API**: copy the *Project URL* and the *anon public* key.

Only emails listed in `public.admins` can write; this is enforced by the database itself
(row level security), so visitors cannot change anything even by calling the API directly.

## 2. Run it locally first

```bash
cp .env.example .env.local     # paste the URL and anon key
npm install
npm run dev                    # http://localhost:3000  (admin: /admin)
npm run build                  # make sure this succeeds before deploying
```

## 3. Deploy on Vercel

1. Commit and push this folder to your GitHub repo.
2. https://vercel.com → **Add New → Project** → import the repo (framework: Next.js is detected).
3. Add environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. Every later `git push` redeploys automatically.

## Using the admin page

- Click a person: edit name or photo, add a child, add a spouse, or delete.
- **Marriage:** drag from one person's left/right dot to another person's left/right dot. A dashed gold line with a ring
  appears; children's arrows start from that ring.
- **Child:** drag from the parent's bottom dot to the child's top dot.
- **Remove a connection:** click the line and press Delete (Backspace).
- Drag names to arrange them; positions are saved for everyone. "Auto-arrange" lays the whole tree out again.

## Notes

- Photos are shrunk in the browser (max 640 px, JPEG). Use JPEG, PNG or WebP (not HEIC).
- Layout is designed for one root ancestor. A person can have more than one spouse, but the layout is tidiest with one or two.
- Deleting a person keeps their children in the tree, but detached from that parent.
