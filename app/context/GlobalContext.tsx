"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"

export type LocationType = {
  lat: number
  lon: number
}

interface GlobalContextType {
  lastBirdLocation: LocationType | null
  setLastBirdLocation: (loc: LocationType | null) => void
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined)

export const GlobalProvider = ({ children }: { children: ReactNode }) => {
  const [lastBirdLocation, setLastBirdLocation] = useState<LocationType | null>(
    null
  )

  return (
    <GlobalContext.Provider value={{ lastBirdLocation, setLastBirdLocation }}>
      {children}
    </GlobalContext.Provider>
  )
}

export const useGlobalContext = () => {
  const context = useContext(GlobalContext)
  if (!context) {
    throw new Error("useGlobalContext must be used within a GlobalProvider")
  }
  return context
}
