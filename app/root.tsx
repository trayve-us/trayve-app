import type { LinksFunction } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

import tailwindCSS from "./styles/tailwind.css?url";
import { Toaster } from "~/components/ui/toaster";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: tailwindCSS },
];

export default function App() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
