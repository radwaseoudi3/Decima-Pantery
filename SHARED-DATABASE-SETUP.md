# Decima Pantry - make phone orders appear on the Barista computer

The website itself can stay on **GitHub Pages**. GitHub Pages is static, so a small shared database is required for orders to move between different phones/computers.

This project is already coded for **Supabase**. You only need to connect it once.

## 1. Create a Supabase project

Create a free Supabase project at https://supabase.com and wait for the project to finish creating.

## 2. Create the two staff users

In Supabase go to **Authentication -> Users -> Add user**.

Create:

- `pantry-admin@decimaintl.com` - choose the Admin password you want.
- `pantry-barista@decimaintl.com` - choose the Barista password you want.

You can keep the familiar passwords if this is only an internal prototype, but use stronger passwords for real use.

The app login usernames remain simply `admin` and `barista`. The email mapping happens behind the scenes.

## 3. Create the pantry database

Go to **SQL Editor**, create a new query, copy everything from `SUPABASE-SETUP.sql`, and click **Run**.

This creates:

- shared orders
- ingredients/inventory
- drinks and bilingual drink names
- recipes
- bilingual delivery locations
- staff permissions
- the order function that deducts recipe inventory and **5 g per sugar spoon**

## 4. Connect this website

In Supabase go to **Project Settings -> API** and copy:

- Project URL
- anon/public key

Open `cloud-config.js` and replace the placeholders:

```js
window.DECIMA_PANTRY_CLOUD = {
  enabled: true,
  supabaseUrl: 'YOUR PROJECT URL',
  anonKey: 'YOUR ANON KEY',
  adminEmail: 'pantry-admin@decimaintl.com',
  baristaEmail: 'pantry-barista@decimaintl.com',
  pollMs: 2000
};
```

Do **not** put a Supabase service-role key in GitHub. The anon key is the correct browser key; database permissions are controlled by the SQL policies.

## 5. Preserve ingredients/drinks already added in the old browser

The code keeps the same local-storage key as the version you sent, so old Admin entries from that same browser are not intentionally erased.

After cloud mode is enabled:

1. Open the site in the browser where the Admin previously added the data.
2. Sign in as Admin.
3. Open **Shared database**.
4. Click **Move this browser's current drinks, ingredients & locations to cloud**.
5. Do this once.

That copies the browser's existing pantry setup into the shared database.

## 6. Put the files on GitHub Pages

Upload the contents of this folder to the GitHub Pages repository with `index.html` at the repository root. GitHub Pages will serve the app; Supabase will hold the shared data.

## What changes after this is connected?

An employee can order on a phone. Within about two seconds the order appears on the Barista computer. The Barista bell keeps ringing until every **new** order has been clicked as received. Admin changes to drinks, recipes, ingredients and locations also become shared across devices.
