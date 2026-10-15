import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for api routes, _next, and files (anything with
  // a dot: sitemap.xml, robots.txt, manifest.json, images), which would
  // otherwise be redirected to a missing /en/... path.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
