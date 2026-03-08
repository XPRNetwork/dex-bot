import * as _chain from "as-chain";
import { PermissionLevel, PublicKey, Table, Name } from "../..";


@packer(nocodegen)
export class KeyWeight implements _chain.Packer {
    
    constructor(
        public key: PublicKey = new PublicKey(),
        public weight: u16 = 0
    ){
        
    }
    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.key);
        enc.packNumber<u16>(this.weight);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new PublicKey();
            dec.unpack(obj);
            this.key = obj;
        }
        this.weight = dec.unpackNumber<u16>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.key.getSize();
        size += sizeof<u16>();
        return size;
    }
}


@packer(nocodegen)
export class PermissionLevelWeight implements _chain.Packer {
    
    constructor(
        public permission: PermissionLevel = new PermissionLevel(),
        public weight: u16 = 0
    ){
        
    }

    static from(actor: Name, permission: string, weight: u16): PermissionLevelWeight {
        return new PermissionLevelWeight(new PermissionLevel(actor, Name.fromString(permission)), weight)
    }

    toAuthority(): Authority {
        return new Authority(this.weight, [], [this], [])
    }
    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.pack(this.permission);
        enc.packNumber<u16>(this.weight);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        
        {
            let obj = new PermissionLevel();
            dec.unpack(obj);
            this.permission = obj;
        }
        this.weight = dec.unpackNumber<u16>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += this.permission.getSize();
        size += sizeof<u16>();
        return size;
    }
}


@packer(nocodegen)
export class WaitWeight implements _chain.Packer {
    
    constructor(
        public waitSec: u16 = 0,
        public weight: u16 = 0
    ){
        
    }
    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.packNumber<u16>(this.waitSec);
        enc.packNumber<u16>(this.weight);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        this.waitSec = dec.unpackNumber<u16>();
        this.weight = dec.unpackNumber<u16>();
        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += sizeof<u16>();
        size += sizeof<u16>();
        return size;
    }
}


@packer(nocodegen)
export class Authority implements _chain.Packer {
    
    constructor(
        public threshold: u32 = 0,
        public keys: KeyWeight[] = new Array<KeyWeight>(),
        public accounts: PermissionLevelWeight[] = new Array<PermissionLevelWeight>(),
        public waits: WaitWeight[] = new Array<WaitWeight>()
    ) {
        
    }
    pack(): u8[] {
        let enc = new _chain.Encoder(this.getSize());
        enc.packNumber<u32>(this.threshold);
        enc.packObjectArray(this.keys);
        enc.packObjectArray(this.accounts);
        enc.packObjectArray(this.waits);
        return enc.getBytes();
    }
    
    unpack(data: u8[]): usize {
        let dec = new _chain.Decoder(data);
        this.threshold = dec.unpackNumber<u32>();
        
    {
        let length = <i32>dec.unpackLength();
        this.keys = new Array<KeyWeight>(length)
        for (let i=0; i<length; i++) {
            let obj = new KeyWeight();
            this.keys[i] = obj;
            dec.unpack(obj);
        }
    }

        
    {
        let length = <i32>dec.unpackLength();
        this.accounts = new Array<PermissionLevelWeight>(length)
        for (let i=0; i<length; i++) {
            let obj = new PermissionLevelWeight();
            this.accounts[i] = obj;
            dec.unpack(obj);
        }
    }

        
    {
        let length = <i32>dec.unpackLength();
        this.waits = new Array<WaitWeight>(length)
        for (let i=0; i<length; i++) {
            let obj = new WaitWeight();
            this.waits[i] = obj;
            dec.unpack(obj);
        }
    }

        return dec.getPos();
    }

    getSize(): usize {
        let size: usize = 0;
        size += sizeof<u32>();
        size += _chain.calcPackedVarUint32Length(this.keys.length);
        for (let i=0; i<this.keys.length; i++) {
            size += this.keys[i].getSize();
        }

        size += _chain.calcPackedVarUint32Length(this.accounts.length);
        for (let i=0; i<this.accounts.length; i++) {
            size += this.accounts[i].getSize();
        }

        size += _chain.calcPackedVarUint32Length(this.waits.length);
        for (let i=0; i<this.waits.length; i++) {
            size += this.waits[i].getSize();
        }

        return size;
    }
}