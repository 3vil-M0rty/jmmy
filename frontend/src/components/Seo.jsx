import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/**
 * Tiny dependency-free SEO helper.
 * Sets the document <title>, meta description, canonical URL, and the
 * primary Open Graph / Twitter tags per route, in the active language.
 */
function setMeta(attr, key, content) {
    if (content == null) return;
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute("content", content);
}

export default function Seo({ titleKey, descriptionKey }) {
    const { t, i18n } = useTranslation();

    useEffect(() => {
        const siteName = t("seo.siteName");
        const title = titleKey ? `${t(titleKey)} · ${siteName}` : siteName;
        const description = descriptionKey ? t(descriptionKey) : t("seo.defaultDescription");

        document.title = title;
        document.documentElement.lang = i18n.language;

        setMeta("name", "description", description);
        setMeta("property", "og:title", title);
        setMeta("property", "og:description", description);
        setMeta("property", "og:site_name", siteName);
        setMeta("property", "og:type", "website");
        setMeta("property", "og:url", window.location.href);
        setMeta("name", "twitter:title", title);
        setMeta("name", "twitter:description", description);

        // Canonical link
        let canonical = document.head.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement("link");
            canonical.setAttribute("rel", "canonical");
            document.head.appendChild(canonical);
        }
        canonical.setAttribute("href", window.location.origin + window.location.pathname);
    }, [t, i18n.language, titleKey, descriptionKey]);

    return null;
}
