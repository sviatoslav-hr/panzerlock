import {toRadians} from '#/math';
import {Vector2} from '#/math/vector';

type TransformMatrix = {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
};

/**
 * The transformation matrix is described by:
 * |a c e|
 * |b d f|
 * |0 0 1|
 * e and f control the horizontal and vertical translation of the context.
 * When b and c are 0, a and d control the horizontal and vertical scaling of the context.
 * When a and d are 1, b and c control the horizontal and vertical skewing of the context.
 */
export class Transform implements TransformMatrix {
    constructor(
        public a: number,
        public b: number,
        public c: number,
        public d: number,
        public e: number,
        public f: number,
    ) {}

    static create(a: number, b: number, c: number, d: number, e: number, f: number): Transform {
        return new Transform(a, b, c, d, e, f);
    }

    static from(m: TransformMatrix): Transform {
        return new Transform(m.a, m.b, m.c, m.d, m.e, m.f);
    }

    static makeCrear(): Transform {
        return new Transform(1, 0, 0, 1, 0, 0);
    }

    static makeTranslation(x: number, y: number): Transform;
    static makeTranslation(position: Vector2): Transform;
    static makeTranslation(position: Vector2 | number, y?: number): Transform {
        const x = typeof position === 'number' ? position : position.x;
        y = typeof position === 'number' ? y : position.y;
        assert(y != null);
        return Transform.from({
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            e: x,
            f: y,
        });
    }

    static makeRotation(radiansAngle: number): Transform {
        const cosTheta = Math.cos(radiansAngle);
        const sinTheta = Math.sin(radiansAngle);
        return new Transform(cosTheta, sinTheta, -sinTheta, cosTheta, 0, 0);
    }

    static makeScale(sx: number, sy: number): Transform {
        return new Transform(sx, 0, 0, sy, 0, 0);
    }

    static multiply(m1: Transform, m2: Transform): Transform {
        const a = m1.a * m2.a + m1.c * m2.b;
        const c = m1.a * m2.c + m1.c * m2.d;
        const e = m1.a * m2.e + m1.c * m2.f + m1.e;
        const b = m1.b * m2.a + m1.d * m2.b;
        const d = m1.b * m2.c + m1.d * m2.d;
        const f = m1.b * m2.e + m1.d * m2.f + m1.f;
        return Transform.from({a, b, c, d, e, f});
    }

    // NOTE: make sure to not overuse it, since creating a new object can get expensive
    get position(): Vector2 {
        return new Vector2(this.e, this.f);
    }

    set position(vec: Vector2) {
        this.e = vec.x;
        this.f = vec.y;
    }

    get scaling(): Vector2 {
        const scaleX = Math.sqrt(this.a * this.a + this.b * this.b);
        const scaleY = Math.sqrt(this.c * this.c + this.d * this.d);
        return new Vector2(scaleX, scaleY);
    }

    get rotation(): number {
        return Math.atan2(this.c, this.d);
    }

    translate(position: Vector2): this {
        return this.multiply(Transform.makeTranslation(position));
    }

    rotateDeg(degAngle: number): this {
        return this.rotate(toRadians(degAngle));
    }

    rotate(radianAngle: number): this {
        const rotation = Transform.makeRotation(-radianAngle);
        return this.premultiply(rotation);
    }

    // TODO: consider using Vector2 instead of 2 params
    scale(s: number): this;
    scale(sx: number, sy: number): this;
    scale(sx: number, sy = sx): this {
        if (sx === 1 && sy === 1) return this;
        return this.premultiply(Transform.makeScale(sx, sy));
    }

    multiply(other: Transform): this {
        return this.set(Transform.multiply(this, other));
    }

    premultiply(other: Transform): this {
        return this.set(Transform.multiply(other, this));
    }

    set(other: TransformMatrix): this {
        this.a = other.a;
        this.b = other.b;
        this.c = other.c;
        this.d = other.d;
        this.e = other.e;
        this.f = other.f;
        return this;
    }

    reset(): this {
        return this.set({a: 1, b: 0, c: 0, d: 1, e: 0, f: 0});
    }

    copy(): Transform {
        return Transform.from(this);
    }
}
