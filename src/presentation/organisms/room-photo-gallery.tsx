"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const RoomPhotoLightbox = dynamic(() => import("./room-photo-lightbox"), {
  ssr: false,
});

const ROOM_PARAM = "habitacion";
const PHOTO_PARAM = "foto";

export type RoomPhotoGalleryImage = Readonly<{ src: string; alt: string }>;

type RoomPhotoLocation = Readonly<{ roomSlug: string; index: number }>;

type RoomPhotoTarget = Readonly<{
  roomSlug: string;
  index: number;
  images: readonly RoomPhotoGalleryImage[];
}>;

type RoomPhotoGalleryContextValue = Readonly<{
  registerRoom: (
    roomSlug: string,
    images: readonly RoomPhotoGalleryImage[]
  ) => void;
  openPhoto: (roomSlug: string, index: number) => void;
}>;

const RoomPhotoGalleryContext =
  createContext<RoomPhotoGalleryContextValue | null>(null);

export function useRoomPhotoGallery(): RoomPhotoGalleryContextValue {
  const context = useContext(RoomPhotoGalleryContext);
  if (!context) {
    throw new Error(
      "useRoomPhotoGallery must be used within a RoomPhotoGalleryProvider"
    );
  }
  return context;
}

export function useOptionalRoomPhotoGallery(): RoomPhotoGalleryContextValue | null {
  return useContext(RoomPhotoGalleryContext);
}

function parseLocation(
  searchParams: URLSearchParams,
  singleRoomSlug: string | undefined
): RoomPhotoLocation | null {
  const photoParam = searchParams.get(PHOTO_PARAM);
  if (!photoParam) return null;

  const photoNumber = Number(photoParam);
  if (!Number.isInteger(photoNumber) || photoNumber < 1) return null;

  const roomSlug = singleRoomSlug ?? searchParams.get(ROOM_PARAM);
  if (!roomSlug) return null;

  return { roomSlug, index: photoNumber - 1 };
}

function RoomPhotoGalleryProviderInner({
  children,
  singleRoomSlug,
  pendingOpen,
  onPendingOpenConsumed,
}: Readonly<{
  children: ReactNode;
  singleRoomSlug?: string;
  pendingOpen: RoomPhotoLocation | null;
  onPendingOpenConsumed: () => void;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const registryRef = useRef(
    new Map<string, readonly RoomPhotoGalleryImage[]>()
  );
  const pendingTargetRef = useRef<RoomPhotoLocation | null>(
    pendingOpen ?? parseLocation(searchParams, singleRoomSlug)
  );

  const [open, setOpen] = useState<RoomPhotoTarget | null>(null);

  const latestLocationRef = useRef({ pathname, searchParams, singleRoomSlug });
  useEffect(() => {
    latestLocationRef.current = { pathname, searchParams, singleRoomSlug };
  });

  const buildUrl = useCallback((target: RoomPhotoLocation | null) => {
    const { pathname, searchParams, singleRoomSlug } =
      latestLocationRef.current;
    const params = new URLSearchParams(searchParams.toString());
    if (target) {
      if (!singleRoomSlug) params.set(ROOM_PARAM, target.roomSlug);
      params.set(PHOTO_PARAM, String(target.index + 1));
    } else {
      params.delete(ROOM_PARAM);
      params.delete(PHOTO_PARAM);
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, []);

  useEffect(() => {
    if (!pendingOpen) return;

    pendingTargetRef.current = pendingOpen;
    const images = registryRef.current.get(pendingOpen.roomSlug);
    if (!images?.length) return;

    const target = {
      roomSlug: pendingOpen.roomSlug,
      index: Math.min(Math.max(pendingOpen.index, 0), images.length - 1),
      images,
    };
    router.push(buildUrl(target), { scroll: false });
    pendingTargetRef.current = null;
    setOpen(target);
    onPendingOpenConsumed();
  }, [buildUrl, onPendingOpenConsumed, pendingOpen, router]);

  const registerRoom = useCallback(
    (roomSlug: string, images: readonly RoomPhotoGalleryImage[]) => {
      registryRef.current.set(roomSlug, images);

      const pending = pendingTargetRef.current;
      if (pending && pending.roomSlug === roomSlug && images.length) {
        pendingTargetRef.current = null;
        setOpen({
          roomSlug,
          index: Math.min(Math.max(pending.index, 0), images.length - 1),
          images,
        });
      }
    },
    []
  );

  const openPhoto = useCallback(
    (roomSlug: string, index: number) => {
      const images = registryRef.current.get(roomSlug);
      if (!images?.length) {
        const pending = { roomSlug, index };
        pendingTargetRef.current = pending;
        router.push(buildUrl(pending), { scroll: false });
        return;
      }

      const target: RoomPhotoTarget = {
        roomSlug,
        index: Math.min(Math.max(index, 0), images.length - 1),
        images,
      };

      if (open) {
        router.replace(buildUrl(target), { scroll: false });
      } else {
        router.push(buildUrl(target), { scroll: false });
      }
      setOpen(target);
    },
    [buildUrl, open, router]
  );

  const handleViewChange = useCallback(
    (index: number) => {
      if (!open) return;
      const next = { ...open, index };
      router.replace(buildUrl(next), { scroll: false });
      setOpen(next);
    },
    [buildUrl, open, router]
  );

  const close = useCallback(() => {
    setOpen(null);
    router.replace(buildUrl(null), { scroll: false });
  }, [buildUrl, router]);

  useEffect(() => {
    const location = parseLocation(searchParams, singleRoomSlug);

    if (!location) {
      pendingTargetRef.current = null;
      // The URL is the source of truth when the browser back button removes the photo query.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen((current) => (current ? null : current));
      return;
    }

    const images = registryRef.current.get(location.roomSlug);
    if (!images?.length) {
      pendingTargetRef.current = location;
      return;
    }

    pendingTargetRef.current = null;
    const clampedIndex = Math.min(
      Math.max(location.index, 0),
      images.length - 1
    );
    setOpen((current) =>
      current &&
      current.roomSlug === location.roomSlug &&
      current.index === clampedIndex
        ? current
        : { roomSlug: location.roomSlug, index: clampedIndex, images }
    );
  }, [searchParams, singleRoomSlug]);

  const value = useMemo<RoomPhotoGalleryContextValue>(
    () => ({ registerRoom, openPhoto }),
    [registerRoom, openPhoto]
  );

  return (
    <RoomPhotoGalleryContext.Provider value={value}>
      {children}
      {open ? (
        <RoomPhotoLightbox
          close={close}
          index={open.index}
          onViewChange={handleViewChange}
          slides={open.images}
        />
      ) : null}
    </RoomPhotoGalleryContext.Provider>
  );
}

export function RoomPhotoGalleryProvider(
  props: Readonly<{ children: ReactNode; singleRoomSlug?: string }>
) {
  const [pendingOpen, setPendingOpen] = useState<RoomPhotoLocation | null>(
    null
  );
  const fallbackValue = useMemo<RoomPhotoGalleryContextValue>(
    () => ({
      registerRoom: () => {},
      openPhoto: (roomSlug, index) => setPendingOpen({ roomSlug, index }),
    }),
    []
  );

  return (
    <Suspense
      fallback={
        <RoomPhotoGalleryContext.Provider value={fallbackValue}>
          {props.children}
        </RoomPhotoGalleryContext.Provider>
      }
    >
      <RoomPhotoGalleryProviderInner
        {...props}
        pendingOpen={pendingOpen}
        onPendingOpenConsumed={() => setPendingOpen(null)}
      />
    </Suspense>
  );
}
