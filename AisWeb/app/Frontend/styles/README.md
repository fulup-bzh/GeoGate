WARNING note about global style dir
-------------------------------------

 - styles placed in Frontend/styles is global and will be posted in dist.prod/styles
 - styles defined within widget or page directory will be place in dist.prof/opa/styles

This model allows to share global styles by multiple applications.

To change this behaviour just rename styles directory on something else [eg: appstyles]


    |---- /Frontend
    |     |
    |     |---- /styles
    |     |     |
    |     |     |---- _settings.scss
    |     |     |---- app.scss
    |     |
    |     |---- /Widgets
    |     |     |
    |     |     |--- widget.js
    |     |     |--- widget.sccs
    |     |
    |     |-----/Pages
    |           |--- page-partial.html
    |           |--- page-cntrl.js
    |           |--- page-style.scss 
    |
