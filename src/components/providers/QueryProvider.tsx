'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Duree pendant laquelle une donnee est consideree fraiche.
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: 1,
            // Rafraichir en revenant sur l'onglet.
            //
            // C'etait `false`, alors que le commentaire d'origine annoncait
            // l'inverse. Consequence concrete, signalee DEUX FOIS par
            // l'exploitation : on saisit un stock, on va faire autre chose, on
            // revient sur l'onglet — et l'ancienne valeur est toujours la. La
            // donnee etait pourtant bien enregistree ; seul l'affichage
            // mentait.
            //
            // Le cout est faible : combine a staleTime, la requete n'est
            // rejouee que si la donnee a plus de cinq minutes.
            refetchOnWindowFocus: true,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
