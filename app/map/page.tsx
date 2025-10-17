import dynamic from "next/dynamic";
import Link from "next/link";

// Map component’ini SSR kapalı olarak import et
const MapNoSSR = dynamic(() => import("./Map"), { ssr: false });

export default function Page() {
  return(<div className="relative">
    <Link href="/camera" className="absolute top-4 left-4 z-20 bg-white p-2 rounded shadow">
    Camera
    </Link>
    <MapNoSSR />
  </div>
    );
}
