import dynamic from "next/dynamic";
import Link from "next/link";
import { Camera } from "lucide-react";

// Map component’ini SSR kapalı olarak import et
const MapNoSSR = dynamic(() => import("./Map"), { ssr: false });

export default function Page() {
  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Floating Action Button for Camera */}
      <Link 
        href="/camera" 
        className="absolute bottom-8 right-8 z-[1000] flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-xl transition-all hover:scale-110 active:scale-95 ring-4 ring-orange-500/30 hover:shadow-orange-500/40"
      >
        <Camera size={32} />
      </Link>
      
      <MapNoSSR />
    </div>
  );
}
