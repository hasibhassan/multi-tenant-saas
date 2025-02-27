export const siteConfig = {
  name: "Dashboard",
  url: "",
  description: "The only dashboard you will ever need.",
  baseLinks: {
    home: "/dashboard",
    overview: "/dashboard/overview",
    details: "/dashboard/details",
    settings: {
      general: "/dashboard/settings/general",
      billing: "/dashboard/settings/billing",
      users: "/dashboard/settings/users",
    },
  },
}

export type siteConfig = typeof siteConfig
