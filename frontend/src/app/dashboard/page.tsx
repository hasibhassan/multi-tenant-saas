"use client"
import { useAuth } from "@/components/AuthProvider"
import { RiAddFill } from "@remixicon/react"
import { Tab, TabGroup, TabList } from "@tremor/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function Page() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      // If a user is already authenticated, redirect them away from login
      router.push("/dashboard/overview")
    }
  }, [user, loading, router])

  return (
    <>
      <h3 className="text-tremor-title text-tremor-content-strong dark:text-dark-tremor-content-strong font-bold">
        Dashboard
      </h3>
      <p className="text-tremor-default text-tremor-content dark:text-dark-tremor-content mt-1 leading-6">
        View and analyze current stats about your business
      </p>
      <TabGroup className="mt-6">
        <TabList>
          <Tab>Overview</Tab>
          <Tab>Detail</Tab>
        </TabList>
        {/* Content below only for demo purpose placed outside of <Tab> component. Add <TabPanels>, <TabPanel> to make it functional and to add content for other tabs */}
        <div className="relative">
          <ul
            role="list"
            className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            <li className="rounded-tremor-default bg-tremor-background-subtle dark:bg-dark-tremor-background-subtle h-44" />
            <li className="rounded-tremor-default bg-tremor-background-subtle dark:bg-dark-tremor-background-subtle h-44" />
            <li className="rounded-tremor-default bg-tremor-background-subtle dark:bg-dark-tremor-background-subtle hidden h-44 sm:block" />
            <li className="rounded-tremor-default bg-tremor-background-subtle dark:bg-dark-tremor-background-subtle hidden h-44 sm:block" />
            <li className="rounded-tremor-default bg-tremor-background-subtle dark:bg-dark-tremor-background-subtle hidden h-44 sm:block" />
            <li className="rounded-tremor-default bg-tremor-background-subtle dark:bg-dark-tremor-background-subtle hidden h-44 sm:block" />
          </ul>
          {/* Change dark:from-gray-950 in parent below according to your dark mode background */}
          <div className="absolute inset-x-0 bottom-0 flex h-32 flex-col items-center justify-center bg-gradient-to-t from-white to-transparent dark:from-gray-950">
            <p className="text-tremor-content-strong dark:text-dark-tremor-content-strong font-medium">
              No reports created yet
            </p>
            <p className="text-tremor-default text-tremor-content dark:text-dark-tremor-content mt-2">
              Create your first report to get started
            </p>
            <button
              type="button"
              className="rounded-tremor-small bg-tremor-brand text-tremor-default text-tremor-brand-inverted shadow-tremor-dropdown hover:bg-tremor-brand-emphasis dark:bg-dark-tremor-brand dark:text-dark-tremor-brand-inverted dark:shadow-dark-tremor-dropdown dark:hover:bg-dark-tremor-brand-emphasis mt-6 inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 font-medium"
            >
              <RiAddFill className="-ml-1 size-5 shrink-0" aria-hidden={true} />
              Connect database
            </button>
          </div>
        </div>
      </TabGroup>
    </>
  )
}
