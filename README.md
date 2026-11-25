# Decima Pantry - Live Server Version

This version was rewritten as a **static HTML/CSS/JavaScript app** so it can run directly with the **Live Server** extension in Visual Studio Code.

## Open it

1. Extract the ZIP.
2. Open the `DecimaPantry_LiveServer` folder in **Visual Studio Code**.
3. Install the **Live Server** extension if you do not already have it.
4. Right-click `index.html`.
5. Choose **Open with Live Server**.

There is no `.NET`, SQL Server, migration, build, or `dotnet run` step in this version.

## Demo staff accounts

### Barista
- Username: `barista`
- Password: `Coffee123!`
- Access: incoming orders only; can accept orders and mark them complete.

### Admin
- Username: `admin`
- Password: `Decima123!`
- Access: dashboard, orders, drinks/recipes, and inventory.

## Sugar rule

One sugar spoon is **5 grams**. Sugar inventory is reduced by:

`number of cups × sugar spoons per cup × 5 g`

## Coffee-shop bell

The Barista/Admin order queue uses a soft multi-tone bell made with the browser Web Audio API. Use **Test bell** after login if the browser has not yet enabled audio.

## Storage / important limitation

This Live Server build stores data in the browser using `localStorage`.

- It persists when you refresh the page.
- Separate tabs on the same browser/origin can see the same data and update one another.
- It is suitable for design review and local demonstration.
- **It does not provide a shared database between different phones/computers.** A real office deployment where employees order from their phones and a barista sees those orders on a separate device needs a shared backend/database or cloud service.

Because this is a static Live Server app, the demo usernames/passwords are visible in the JavaScript source and are **not production security**.
