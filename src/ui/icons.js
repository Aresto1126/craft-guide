const shapes={
 grass:'<path fill="#93643e" d="M3 10h26v19H3z"/><path fill="#568e40" d="M2 4h28v9H2zM5 12h5v5H5zm12 0h6v4h-6z"/><path fill="#8fbd5d" d="M3 4h8v4H3zm14 0h12v4H17z"/><path fill="#b0804f" d="M6 21h5v4H6zm14-3h5v5h-5z"/>',
 chest:'<path fill="#493d2c" d="M2 6h28v23H2z"/><path fill="#b8803c" d="M4 8h24v8H4zm0 10h24v9H4z"/><path fill="#e5b95e" d="M5 8h22v3H5z"/><path fill="#d8d9b9" d="M14 14h4v7h-4z"/>',
 hopper:'<path fill="#343e40" d="M2 4h28v9l-9 9v7h-9v-7l-10-9z"/><path fill="#84918c" d="M3 4h26v5H3z"/><path fill="#172522" d="M7 6h18v2H7z"/><path fill="#53635d" d="M6 12h20l-7 8h-6z"/>',
 ingot:'<path fill="#46575b" d="m2 15 9-8h16l4 10-10 9H5z"/><path fill="#c3cec7" d="m4 15 8-6h14l-7 7H4z"/><path fill="#8fa6a2" d="M4 17h15v7H6z"/><path fill="#637f7e" d="m21 17 7-6 1 6-8 7z"/>',
 book:'<path fill="#4d4534" d="M3 7h11l2 2 2-2h11v22H18l-2 2-2-2H3z"/><path fill="#ead7a2" d="M5 9h8l2 2v15l-2-1H5zm13 2 2-2h7v16h-7l-2 1z"/><path fill="#a09267" d="M7 13h5v2H7zm13 0h5v2h-5zM7 18h5v2H7zm13 0h5v2h-5z"/>',
 pickaxe:'<path fill="#745638" d="m7 27-3-3L21 7l4 4z"/><path fill="#98b9b3" d="M7 4h16l7 7v9h-5v-7l-5-4H7z"/><path fill="#d1dfd4" d="M7 3h16v4H7z"/>',
 torch:'<path fill="#795537" d="m13 14 6-1-3 17h-6z"/><path fill="#e9a745" d="M9 5h13v11H9z"/><path fill="#ffe0a0" d="M12 1h7v11h-7z"/>',
 home:'<path fill="currentColor" d="M3 14 16 3l13 11v4h-4v12h-7v-9h-5v9H6V18H3z"/>',
 settings:'<path fill="currentColor" d="M12 2h8v5l4 2 4-1 3 7-4 3-1 4 2 4-6 5-4-3h-4l-4 3-6-5 2-4-1-4-4-3 3-7 4 1 4-2z"/><path fill="var(--panel-solid)" d="M11 12h10v10H11z"/>',
 search:'<path fill="none" stroke="currentColor" stroke-width="3" d="M23 23 30 30M24 14a10 10 0 1 1-20 0 10 10 0 0 1 20 0"/>',
 note:'<path fill="#ced3b6" d="M6 2h16l6 6v22H6z"/><path fill="#7c9277" d="M10 11h13v2H10zm0 6h13v2H10zm0 6h9v2h-9z"/>',
 cave:'<path fill="#414e55" d="M2 7h28v23H2z"/><path fill="#172a33" d="M9 15h14v15H9z"/><path fill="#7dc1be" d="M4 9h4v4H4zm19 1h4v4h-4z"/>'
};
export function icon(name,cls=''){return `<svg class="icon ${cls}" viewBox="0 0 32 32" aria-hidden="true" shape-rendering="crispEdges">${shapes[name]??shapes.grass}</svg>`;}
export function itemIcon(id){if(/hopper/.test(id))return'hopper';if(/chest/.test(id))return'chest';if(/torch|coal/.test(id))return'torch';if(/ingot|iron|rail|bucket/.test(id))return'ingot';if(/pickaxe/.test(id))return'pickaxe';if(/stone|furnace/.test(id))return'cave';if(/table|plank|log|stick/.test(id))return'chest';return'grass';}
