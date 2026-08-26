import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

/** Cancel in-flight tenant reads and remove every cached private result. */
export async function clearPrivateQueryState() {
  await queryClient.cancelQueries()
  queryClient.clear()
}
