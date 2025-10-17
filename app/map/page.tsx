import dynamic from "next/dynamic";

// Map component’ini SSR kapalı olarak import et
const MapNoSSR = dynamic(() => import("./Map"), { ssr: false });

export default function Page() {
  return <MapNoSSR />;
}
