/* eslint-disable @typescript-eslint/naming-convention */
//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  const oldRoutes = [];

  let urlFilter = "";

  let selectedRoute = null;

  // Handle messages sent from the extension to the webview
  window.addEventListener("message", (event) => {
    const message = event.data; // The json data that the extension sent
    switch (message.type) {
      case "setRoutes": {
        const routes = message.value;
        if (JSON.stringify(routes) === JSON.stringify(oldRoutes)) {
          return;
        }
        updateRoutes(routes, urlFilter);
        oldRoutes.length = 0;
        oldRoutes.push(...routes);
        break;
      }
    }
  });

  const urlMatcher = document.getElementById("UrlMatcher");
  if (!urlMatcher) {
    return;
  }
  urlMatcher.addEventListener("input", (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    urlFilter = input.value;
    updateRoutes(oldRoutes, urlFilter);
  });

  /**
   * @param {Array<{ route: string, file: string, pattern, string }>} routes
   * @param {string} urlFilter
   */
  function updateRoutes(routes, urlFilter) {
    const ul = document.querySelector(".route-list");
    if (!ul) {
      return;
    }
    ul.textContent = "";
    const filteredRoutes = urlFilter.length > 0
      ? routes.filter((route) => {
        // Remove trailing slash
        let f = urlFilter;
        if (f.endsWith("/")) {
          f = f.slice(0, -1);
        }

        // @ts-ignore
        const urlPattern = new URLPattern(
          route.pattern,
          "http://localhost:8000/",
        );
        const url = new URL(f, "http://localhost:8000/");
        return urlPattern.test(url);
      })
      : routes;

    if (filteredRoutes.length === 0) {
      const li = document.createElement("li");
      li.className = "route-entry";
      li.textContent = "No routes found";
      ul.appendChild(li);
      return;
    }

    for (const route of filteredRoutes) {
      let cleanedRoute = route.route.replace(
        /index$/,
        "",
      );

      const li = document.createElement("li");
      li.className = "route-entry";

      li.addEventListener("click", () => {
        if (selectedRoute) {
          selectedRoute.classList.remove("selected");
        }
        selectedRoute = li;
        selectedRoute.classList.add("selected");
        vscode.postMessage({
          type: "open",
          value: route.file,
        });
      });

      // Special routes:
      const routeTypeMatcher = [
        {
          fileName: "_app.tsx",
          name: "App Wrapper",
          shortName: "App",
          document: "https://fresh.deno.dev/docs/concepts/app-wrapper",
        },
        {
          fileName: "_layout.tsx",
          name: "Layout",
          shortName: "Layout",
          document: "https://fresh.deno.dev/docs/concepts/layouts",
        },
        {
          fileName: "_middleware.ts",
          name: "Middleware",
          shortName: "Middleware",
          document: "https://fresh.deno.dev/docs/concepts/middleware",
        },
        {
          fileName: "_404.tsx",
          name: "Error page",
          shortName: "Error",
          document: "https://fresh.deno.dev/docs/concepts/error-pages",
        },
        {
          fileName: "_500.tsx",
          name: "Error page",
          shortName: "Error",
          document: "https://fresh.deno.dev/docs/concepts/error-pages",
        },
      ];

      const matched = routeTypeMatcher.find((matcher) =>
        route.file.endsWith(matcher.fileName)
      ) || {
        name: "Route",
        shortName: "Route",
        document: "https://fresh.deno.dev/docs/concepts/routing",
      };

      const routeName = document.createElement("div");
      routeName.className = "route-name";
      li.appendChild(routeName);

      if (matched.shortName === "Route") {
        routeName.appendChild(createRouteIcon());
      } else {
        routeName.appendChild(createSpecialIcon());
      }

      let extLinkHref = `http://localhost:8000/${cleanedRoute}`;
      let extLink = null;

      // Create placeholder for route name
      if (cleanedRoute.indexOf("[") === -1) {
        // plain text
        const routeNameLabel = document.createElement("div");
        routeNameLabel.className = "route-label";
        routeNameLabel.textContent = cleanedRoute || "/ (root)";
        routeName.appendChild(routeNameLabel);
      } else {
        // with param
        const routeNameLabel = document.createElement("div");
        routeNameLabel.className = "route-label";
        const parts = parseBrackets(cleanedRoute);

        for (const part of parts) {
          if (part.type === "literal") {
            const span = document.createElement("span");
            span.textContent = part.value;
            routeNameLabel.appendChild(span);
          } else if (part.type === "param") {
            const input = document.createElement("input");
            input.className = "route-param";
            input.value = part.value;
            input.placeholder = part.value;
            input.addEventListener("click", (e) => {
              e.stopPropagation();
            });

            // Update external link href when input changes
            input.addEventListener("input", (e) => {
              if (!extLink) {
                return;
              }
              extLink.setAttribute(
                "href",
                `http://localhost:8000/${
                  getTextContentChildren(routeNameLabel).join("")
                }`,
              );
            });
            routeNameLabel.appendChild(input);
          }
        }
        extLinkHref = `http://localhost:8000/${
          getTextContentChildren(routeNameLabel).join("")
        }`;
        routeName.appendChild(routeNameLabel);
      }

      const routeAction = document.createElement("div");
      routeAction.className = "route-action";
      li.appendChild(routeAction);

      // Document Link
      routeAction.appendChild(
        createPreviewLink(matched.name, matched.document),
      );

      if (matched.shortName === "Route") {
        extLink = createExternalIcon(
          extLinkHref,
        );
        routeName.appendChild(
          extLink,
        );
      }

      ul.appendChild(li);
    }

    /**
     * @param {string} href
     * @returns {HTMLAnchorElement}
     */
    function createExternalIcon(href) {
      const link = document.createElement("a");
      link.className = "icon-link";
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      const icon = createIcon("#icon-external");
      icon.setAttribute("width", "18");
      icon.setAttribute("height", "18");
      icon.setAttribute("viewBox", "0 0 20 21");
      link.appendChild(icon);
      return link;
    }

    /**
     * @param {string} name
     * @param {string} href
     */
    function createPreviewLink(name, href) {
      const fileLink = document.createElement("a");
      fileLink.className = "file-link";
      fileLink.textContent = name;
      fileLink.href = href;
      return fileLink;
    }
  }

  function createSpecialIcon() {
    return createIcon("#icon-special");
  }

  /**
   * @param {string} id
   * @returns {SVGElement}
   */
  function createIcon(id) {
    const icon = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    icon.setAttribute("width", "24");
    icon.setAttribute("height", "25");
    icon.setAttribute("viewBox", "0 0 24 25");
    icon.classList.add("icon");

    const useTag = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "use",
    );
    useTag.setAttributeNS(
      "http://www.w3.org/1999/xlink",
      "href",
      id,
    );
    icon.appendChild(useTag);
    return icon;
  }

  function createRouteIcon() {
    return createIcon("#icon-path");
  }

  /**
   * @param {HTMLElement} element
   * @returns {string[]}
   * @description Get text content of all children including input.value
   */
  function getTextContentChildren(element) {
    const result = [];
    for (const child of element.childNodes) {
      if (child instanceof HTMLInputElement) {
        result.push(child.value ?? "");
      } else {
        result.push(child.textContent ?? "");
      }
    }
    return result;
  }

  /**
   * parse brackets
   * @param {string} input
   * @returns
   */
  function parseBrackets(input) {
    // input:
    // "/users/[id]/[name]"
    // output:
    // { type: "literal", value: "/users/" }, { type: "param", value: "id" }, { type: "literal", value: "/" }, { type: "param", value: "name" }
    const result = [];
    let current = "";
    let inBrackets = false;
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      if (char === "[") {
        if (current) {
          result.push({ type: "literal", value: current });
          current = "";
        }
        inBrackets = true;
      } else if (char === "]") {
        if (current) {
          result.push({ type: "param", value: current });
          current = "";
        }
        inBrackets = false;
      } else {
        current += char;
      }
    }
    if (current) {
      result.push({ type: "literal", value: current });
    }
    return result;
  }

  window.setInterval(() => {
    vscode.postMessage({ type: "update" });
  }, 10000);

  vscode.postMessage({ type: "update" });
})();
