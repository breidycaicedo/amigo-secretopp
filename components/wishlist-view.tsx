import { wishlistIcon, wishlistItems } from "@/lib/wishlist";

export function WishlistView({ wishlist, emptyText }: { wishlist: string; emptyText: string }) {
  const items = wishlistItems(wishlist);
  if (items.length === 0) {
    return <p className="text-sm italic text-muted">{emptyText}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={`${index}-${item}`}
          className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-[15px] ring-1 ring-line animate-rise"
          style={{ animationDelay: `${120 + index * 60}ms` }}
        >
          <span aria-hidden="true" className="text-lg leading-6">
            {wishlistIcon(item)}
          </span>
          <span className="leading-6 break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}
