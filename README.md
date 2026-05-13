# GWA Genie

A privacy-friendly GWA calculator for tracking subjects, units, and grades in a clean browser-based workspace.

Live site: [https://gwa-genie.vercel.app/](https://gwa-genie.vercel.app/)

## Overview

GWA Genie helps students compute their General Weighted Average by entering subjects, units, and final grades. The app runs as a simple static site and stores entries in the browser so users can continue where they left off on the same device.

## Features

- Add, edit, and remove subject entries
- Calculate weighted GWA instantly
- View quick summary stats for subjects, units, best grade, and worst grade
- Save entries with `localStorage`
- Clear all entries with confirmation
- Responsive UI for desktop and mobile
- Keyboard-friendly focus states and live status updates
- Privacy-friendly Vercel Web Analytics on production

## Tech Stack

- HTML
- CSS
- JavaScript
- Bootstrap 5
- Bootstrap Icons
- Vercel

## Project Structure

```text
gwa-calculator/
|-- index.html
|-- style.css
|-- script.js
```

## Run Locally

This project does not require a build step.

1. Clone the repository.
2. Open the project folder.
3. Start any static server, or open `index.html` directly in a browser.

Example with VS Code Live Server:

1. Open the folder in VS Code.
2. Right-click `index.html`.
3. Choose `Open with Live Server`.

## How It Works

- Users enter a subject name, units, and grade.
- The app validates the input before saving.
- Entries are stored in `localStorage` under the key `gwa-calculator-subjects`.
- GWA is calculated as:

```text
sum(units * grade) / sum(units)
```

- The result panel also shows a simple standing label based on the computed GWA.

## Analytics

Production uses Vercel Web Analytics for page views. The app also attempts to send custom events for:

- `add_subject`
- `calculate_gwa`
- `clear_all`

Note: Vercel custom event availability depends on your Vercel plan.

## Accessibility Notes

- Live feedback regions announce form and result updates
- Inputs show field-level validation states
- Footer links support smooth scrolling
- Reduced-motion users fall back to normal scrolling behavior

## Deployment

The app is deployed on Vercel:

- Production domain: [https://gwa-genie.vercel.app/](https://gwa-genie.vercel.app/)

## Author

[Vicryl Kez Lumanao](https://vklumanao.github.io/)
