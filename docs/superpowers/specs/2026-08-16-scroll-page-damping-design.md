# Scroll Page Damping Design

The homepage remains a two-section vertical composition. A wheel gesture is treated as an intent to move between sections rather than as free continuous scrolling: a downward gesture moves to the second page and an upward gesture returns to the first.

The transition uses a fixed 700 ms ease-out animation. While it is active, further wheel events are ignored, preventing rapid skipped pages. The existing scroll-snap fallback remains available for keyboard, touch, and direct scrollbar navigation.

The time page retains its centered layout, with more separation between greeting, quote, heading, date, clock, and footer. The clock remains visually dominant without crowding the surrounding content.
