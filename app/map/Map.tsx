"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { createClient } from "@supabase/supabase-js"
import { useGlobalContext } from "../context/GlobalContext"
import BirdSidebar from "./BirdSidebar"

// -------- Supabase --------
const supabaseUrl = "https://zngkvqvsilewdlfuqmlj.supabase.co"
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZ2t2cXZzaWxld2RsZnVxbWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MDAzNDcsImV4cCI6MjA3NjA3NjM0N30.TOds7zC_wNwXKBGD6Ey_bz7FcvYgbQBDaQ6kAuijzwg"

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// -------- Types --------
type Prediction = {
  id: string
  species_name: string
  geo: {
    lat: number
    lon: number
  }
}

// -------- Bird Marker Icon --------
const birdIcon = new L.Icon({
  iconUrl: "/bird-icon.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

// -------- Helper Component for Recentering --------
const RecenterMap = ({ lat, lon }: { lat: number; lon: number }) => {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lon], 15) // Zoom seviyesini 15 olarak ayarladım, isteğe bağlı değişebilir
  }, [lat, lon, map])
  return null
}

export default function Map() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBird, setSelectedBird] = useState<string | null>(null)
  const { lastBirdLocation } = useGlobalContext()

  // ---- DB'den tüm predictionları çek ----
  useEffect(() => {
    const fetchPredictions = async () => {
      const { data, error } = await supabase
        .from("predictions")
        .select("id, species_name, geo")

      if (error) {
        console.error("DB fetch error:", error)
      } else {
        setPredictions(data || [])
      }

      setLoading(false)
    }

    fetchPredictions()
  }, [])

  if (loading) {
    return <p className="p-4 text-center">Harita yükleniyor...</p>
  }

  // Varsayılan merkez (örneğin Ankara) veya son konum
  const defaultCenter: [number, number] = lastBirdLocation
    ? [lastBirdLocation.lat, lastBirdLocation.lon]
    : [39.0, 35.0]

  return (
    <>
      <MapContainer
        center={defaultCenter}
        zoom={lastBirdLocation ? 15 : 6}
        style={{ height: "100vh", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        
        {/* Eğer global context'te konum varsa haritayı oraya odakla */}
        {lastBirdLocation && (
          <RecenterMap lat={lastBirdLocation.lat} lon={lastBirdLocation.lon} />
        )}

        {predictions.map((p) => (
          <Marker
            key={p.id}
            position={[p.geo.lat, p.geo.lon]}
            icon={birdIcon}
            eventHandlers={{
              click: () => {
                setSelectedBird(p.species_name)
              },
            }}
          >
          </Marker>
        ))}
      </MapContainer>

      {/* Bird Detail Sidebar */}
      {selectedBird && (
        <BirdSidebar 
          speciesName={selectedBird} 
          onClose={() => setSelectedBird(null)} 
        />
      )}
    </>
  )
}
