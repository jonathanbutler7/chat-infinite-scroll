import React, { useLayoutEffect } from "react";
import Link from "next/link";
import axios from "axios";
import { useInView } from "react-intersection-observer";
import {
  useInfiniteQuery,
  QueryClient,
  QueryClientProvider
} from "@tanstack/react-query";
// import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

const queryClient = new QueryClient();

export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Example />
    </QueryClientProvider>
  );
}

const Logger = ({ index }) => {
  React.useEffect(() => {
    console.log(index, "mount");
    return () => {
      console.log(index, "unmount");
    };
  }, [index]);
  return null;
};

function Example() {
  const { ref, inView } = useInView();
  const pageSize = 50;
  const itemSize = 120;

  const {
    status,
    data,
    error,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage
  } = useInfiniteQuery(
    ["projects"],
    async ({ pageParam = 0 }) => {
      const res = await axios.get(
        `../api/projects?pageSize=${pageSize}&cursor=${pageParam}`
      );
      return res.data;
    },
    {
      getPreviousPageParam: (firstPage) => firstPage.previousId ?? undefined,
      getNextPageParam: (lastPage) => lastPage.nextId ?? undefined
    }
  );

  React.useEffect(() => {
    if (inView) {
      fetchNextPage();
    }
  }, [inView]);

  const rows = React.useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [
    data
  ]);

  // virtualizer logic

  const virtualizerRef = React.useRef(null);

  const count = React.useMemo(() => {
    if (virtualizerRef.current) {
      virtualizerRef.current.scrollOffset += pageSize * itemSize;
    }

    return rows.length;
  }, [rows.length]);

  const reverseIndex = React.useCallback((index) => count - 1 - index, [count]);

  const virtualizer = useWindowVirtualizer({
    count,
    estimateSize: () => 120,
    getItemKey: React.useCallback((index) => rows[reverseIndex(index)].id, [
      rows,
      reverseIndex
    ]),
    overscan: 10
  });

  useIsomorphicLayoutEffect(() => {
    virtualizerRef.current = virtualizer;
  });

  const items = virtualizer.getVirtualItems();

  const [paddingTop, paddingBottom] =
    items.length > 0
      ? [
          items[0].start - virtualizer.options.scrollMargin,
          virtualizer.getTotalSize() - items[items.length - 1].end
        ]
      : [0, 0];
  console.log({
    paddingTop,
    paddingBottom
  });
  return (
    <div>
      {status === "loading" ? (
        <p>Loading...</p>
      ) : status === "error" ? (
        <span>Error: {error.message}</span>
      ) : (
        <div>
          <div style={{ height: 50 }} ref={ref}>
            <button
              onClick={() => fetchNextPage()}
              disabled={!hasNextPage || isFetchingNextPage}
            >
              {isFetchingNextPage
                ? "Loading more..."
                : hasNextPage
                ? "Load Newer"
                : "Nothing more to load"}
            </button>
          </div>
          <div
            style={{
              paddingTop,
              paddingBottom
            }}
          >
            {items.map((item) => {
              const index = reverseIndex(item.index);
              const project = rows[index];
              return (
                <div
                  key={item.key}
                  data-index={item.index}
                  data-reverse-index={index}
                  ref={virtualizer.measureElement}
                >
                  <div
                    style={{
                      padding: 15,
                      background: `hsla(${project.id * 30}, 60%, 80%, 1)`,
                      lineHeight: 1.5
                    }}
                  >
                    <div>
                      {project.name} - {project.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <hr />
      <Link href="/about">
        <a>Go to another page</a>
      </Link>
      {/* <ReactQueryDevtools initialIsOpen /> */}
    </div>
  );
}
