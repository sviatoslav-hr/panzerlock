const Kind = {
    LIGHT: 'light',
    MEDIUM: 'medium',
    HEAVY: 'heavy',
} as const;
type Kind = (typeof Kind)[keyof typeof Kind];

const MAX_UPGRADES = 5;

const hpBase = 20;
const hpPerKind: Record<Kind, number> = {
    [Kind.LIGHT]: hpBase * 2,
    [Kind.MEDIUM]: hpBase * 5,
    [Kind.HEAVY]: hpBase * 8,
};

const A = 6.3;
const B = 3;
const D = 35;
const M = 0.35;
const P = 2;
function est(x: number, d = D, m = M, a = A, b = B, p = P) {
    return d * (1 + m * a * (1 - Math.exp(-Math.pow(x / b, p))));
}

const expectedShotsNeeded: Record<Kind, number>[] = [
    {light: 2, medium: 3, heavy: 5},
    {light: 1, medium: 3, heavy: 4},
    {light: 1, medium: 2, heavy: 4},
    {light: 1, medium: 2, heavy: 3},
    {light: 1, medium: 1, heavy: 2},
    {light: 1, medium: 1, heavy: 1},
];

interface RangeOpts {
    min: number;
    max: number;
    step: number;
}

function findPerfectParams() {
    const dr: RangeOpts = {min: 20, max: 40, step: 1};
    const mr: RangeOpts = {min: 0.05, max: 0.6, step: 0.01};
    const ar: RangeOpts = {min: 1, max: 100, step: 0.1};
    const br: RangeOpts = {min: 1, max: 10, step: 0.1};
    const pr: RangeOpts = {min: 1, max: 10, step: 0.1};
    for (const d of range(dr)) {
        for (const m of range(mr)) {
            for (const a of range(ar)) {
                for (const b of range(br)) {
                    for (const p of range(pr)) {
                        const errOrDamages = testDamageLevels(d, m, a, b, p);
                        if (Array.isArray(errOrDamages)) {
                            console.log('Found perfect params:');
                            console.log({d, m, a, b, p});
                            for (let l = 0; l <= MAX_UPGRADES; l++) {
                                console.log(` Level ${l}: Damage = ${errOrDamages[l].toFixed(2)}`);
                            }
                            return;
                        }
                    }
                }
            }
        }
    }
    console.log('No perfect params found');
}

function* range(r: RangeOpts) {
    for (let v = r.min; v <= r.max; v += r.step) {
        v = Math.round(v * 1e12) / 1e12; // avoid floating point precision issues
        yield v;
    }
}

interface DamageTestError {
    kind: Kind;
    level: number;
}
function testDamageLevels(d = D, m = M, a = A, b = B, p = P): DamageTestError | number[] {
    for (let l = 0; l <= MAX_UPGRADES; l++) {
        const damage = est(l, d, m, a, b, p);
        if (isNaN(damage)) {
            throw new Error('Damage is NaN for l = ' + l);
        }
        const lightShotsNeeded = Math.ceil(hpPerKind.light / damage);
        const mediumShotsNeeded = Math.ceil(hpPerKind.medium / damage);
        const heavyShotsNeeded = Math.ceil(hpPerKind.heavy / damage);
        const expected = expectedShotsNeeded[l];
        if (lightShotsNeeded !== expected.light) {
            return {kind: Kind.LIGHT, level: l};
        }
        if (mediumShotsNeeded !== expected.medium) {
            return {kind: Kind.MEDIUM, level: l};
        }
        if (heavyShotsNeeded !== expected.heavy) {
            return {kind: Kind.HEAVY, level: l};
        }
    }
    // NOTE: Make array only if all tests pass.
    const damages: number[] = [];
    for (let l = 0; l <= MAX_UPGRADES; l++) {
        damages.push(est(l, d, m, a, b, p));
    }
    return damages;
}

function main(): void {
    console.time('took');
    findPerfectParams();
    console.timeEnd('took');
}

main();
