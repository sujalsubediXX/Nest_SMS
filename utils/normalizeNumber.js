export default function normalizeNumber(input) {
    let n = String(input).trim().replace(/[\s-]/g, "");

    if (n.startsWith("+977")) n = n.slice(4);
    else if (n.startsWith("977") && n.length === 13) n = n.slice(3);

    return /^9[78]\d{8}$/.test(n) ? n : null; // 10 digits, starts with 97 or 98
}
