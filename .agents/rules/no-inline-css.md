# No CSS Writing in HTML Pages (Strict Global Rule)

- **NEVER** write CSS inside `<style>` tags or inline `style="..."` attributes within `.html` files across the entire project.
- All styles must strictly reside in external `.css` files (e.g., `css/donor-portal.css`, `css/main.css`, etc.) without modifying or breaking existing CSS rules.
- HTML files must only link to external `.css` stylesheets via `<link rel="stylesheet">`.
