import React, { useEffect, useRef } from 'react';
import { FixedSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import InfiniteLoader from 'react-window-infinite-loader';
import logger from '@/lib/logger';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  hasNextPage: boolean;
  isNextPageLoading: boolean;
  loadNextPage: () => Promise<void>;
  minimumBatchSize?: number;
  threshold?: number;
}

export function VirtualizedList<T>({
  items,
  renderItem,
  itemHeight,
  hasNextPage,
  isNextPageLoading,
  loadNextPage,
  minimumBatchSize = 10,
  threshold = 15,
}: VirtualizedListProps<T>) {
  const infiniteLoaderRef = useRef<any>(null);

  // Reset cache when items change
  useEffect(() => {
    if (infiniteLoaderRef.current) {
      infiniteLoaderRef.current.resetloadMoreItemsCache();
    }
  }, [items]);

  const itemCount = hasNextPage ? items.length + 1 : items.length;

  const loadMoreItems = isNextPageLoading ? () => {} : loadNextPage;

  const isItemLoaded = (index: number) => !hasNextPage || index < items.length;

  const Item = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    if (!isItemLoaded(index)) {
      return (
        <div style={style} className="flex items-center justify-center p-4">
          Loading...
        </div>
      );
    }

    try {
      return <div style={style}>{renderItem(items[index], index)}</div>;
    } catch (error) {
      logger.error('Error rendering list item', error as Error, { index });
      return (
        <div style={style} className="p-4 text-red-500">
          Error rendering item
        </div>
      );
    }
  };

  return (
    <div className="h-full w-full">
      <AutoSizer>
        {({ height, width }) => (
          <InfiniteLoader
            ref={infiniteLoaderRef}
            isItemLoaded={isItemLoaded}
            itemCount={itemCount}
            loadMoreItems={loadMoreItems}
            minimumBatchSize={minimumBatchSize}
            threshold={threshold}
          >
            {({ onItemsRendered, ref }) => (
              <FixedSizeList
                className="scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400"
                height={height}
                width={width}
                itemCount={itemCount}
                itemSize={itemHeight}
                onItemsRendered={onItemsRendered}
                ref={ref}
              >
                {Item}
              </FixedSizeList>
            )}
          </InfiniteLoader>
        )}
      </AutoSizer>
    </div>
  );
}
