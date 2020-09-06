/* eslint-disable */
declare module "vscode-cache" {
  export = Cache;
  class Cache {
    constructor(context: any, namespace?: string);
    put(key: string, value: any, expiration?: number): Promise<any>;
    set(key: any, value: any, expiration: any): Promise<any>;
    save(key: any, value: any, expiration: any): Promise<any>;
    store(key: any, value: any, expiration: any): Promise<any>;
    cache: (key: any, value: any, expiration: any) => Promise<any>;
    get(key: string, defaultValue?: any): any;
    fetch(key: any, defaultValue: any): any;
    retrieve(key: any, defaultValue: any): any;
    has(key: string): boolean;
    exists(key: any): boolean;
    forget(key: string): any;
    remove(key: any): any;
    delete(key: any): any;
    keys(): string[];
    all(): object;
    getAll(): object;
    flush(): any;
    clearAll(): any;
    getExpiration(key: string): number;
    isExpired(key: any): boolean;
  }
}
