export function trueOrNull(x) {
    return x === null || x === 'true';
}

export function parseFromLocalStorage(key, def) {
    const s = localStorage.getItem(key);

    if (s) {
        return JSON.parse(s);
    }

    return def;
}
