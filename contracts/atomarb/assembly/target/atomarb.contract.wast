(module
 (type $i32_=>_i32 (func (param i32) (result i32)))
 (type $i32_i32_=>_i32 (func (param i32 i32) (result i32)))
 (type $i32_i32_=>_none (func (param i32 i32)))
 (type $none_=>_i32 (func (result i32)))
 (type $i32_i32_i32_=>_none (func (param i32 i32 i32)))
 (type $i32_i64_=>_i32 (func (param i32 i64) (result i32)))
 (type $i32_i64_=>_none (func (param i32 i64)))
 (type $i32_i32_i64_i32_=>_i32 (func (param i32 i32 i64 i32) (result i32)))
 (type $i32_=>_i64 (func (param i32) (result i64)))
 (type $i32_i32_i32_=>_i32 (func (param i32 i32 i32) (result i32)))
 (type $i32_=>_none (func (param i32)))
 (type $i64_=>_i32 (func (param i64) (result i32)))
 (type $i32_i32_i32_i32_=>_i32 (func (param i32 i32 i32 i32) (result i32)))
 (type $i32_i32_i32_i32_=>_none (func (param i32 i32 i32 i32)))
 (type $i64_i64_i64_i64_=>_i32 (func (param i64 i64 i64 i64) (result i32)))
 (type $none_=>_i64 (func (result i64)))
 (type $none_=>_none (func))
 (type $i64_=>_none (func (param i64)))
 (type $i32_i32_i32_i32_i32_i32_=>_none (func (param i32 i32 i32 i32 i32 i32)))
 (type $i32_i32_i32_i64_=>_none (func (param i32 i32 i32 i64)))
 (type $i32_i32_i32_i64_i32_=>_none (func (param i32 i32 i32 i64 i32)))
 (type $i32_i32_i64_=>_none (func (param i32 i32 i64)))
 (type $i32_i32_i64_i32_i32_i64_i64_i32_i32_i32_i32_=>_none (func (param i32 i32 i64 i32 i32 i64 i64 i32 i32 i32 i32)))
 (type $i32_i64_i32_=>_none (func (param i32 i64 i32)))
 (type $i32_i64_i32_i32_=>_none (func (param i32 i64 i32 i32)))
 (type $i32_i64_i32_i64_=>_none (func (param i32 i64 i32 i64)))
 (type $i64_i64_i64_=>_none (func (param i64 i64 i64)))
 (type $i32_i64_i64_i32_i64_i64_i64_i64_=>_i32 (func (param i32 i64 i64 i32 i64 i64 i64 i64) (result i32)))
 (type $i64_i32_i32_=>_i32 (func (param i64 i32 i32) (result i32)))
 (type $i64_i32_i32_i64_i64_i64_i64_i64_i64_=>_i32 (func (param i64 i32 i32 i64 i64 i64 i64 i64 i64) (result i32)))
 (type $i64_i32_i64_i64_i64_=>_i32 (func (param i64 i32 i64 i64 i64) (result i32)))
 (type $i64_i64_i32_i64_i64_i64_i64_=>_i32 (func (param i64 i64 i32 i64 i64 i64 i64) (result i32)))
 (type $i64_i64_i64_=>_i32 (func (param i64 i64 i64) (result i32)))
 (type $i64_i64_i64_i64_i32_i32_=>_i32 (func (param i64 i64 i64 i64 i32 i32) (result i32)))
 (import "env" "action_data_size" (func $~lib/as-chain/env/action_data_size (result i32)))
 (import "env" "read_action_data" (func $~lib/as-chain/env/read_action_data (param i32 i32) (result i32)))
 (import "env" "eosio_assert" (func $~lib/as-chain/env/eosio_assert (param i32 i32)))
 (import "env" "require_auth" (func $~lib/as-chain/env/require_auth (param i64)))
 (import "env" "db_find_i64" (func $~lib/as-chain/env/db_find_i64 (param i64 i64 i64 i64) (result i32)))
 (import "env" "db_get_i64" (func $~lib/as-chain/env/db_get_i64 (param i32 i32 i32) (result i32)))
 (import "env" "is_account" (func $~lib/as-chain/env/is_account (param i64) (result i32)))
 (import "env" "memcpy" (func $~lib/as-chain/env/memcpy (param i32 i32 i32) (result i32)))
 (import "env" "db_update_i64" (func $~lib/as-chain/env/db_update_i64 (param i32 i64 i32 i32)))
 (import "env" "db_store_i64" (func $~lib/as-chain/env/db_store_i64 (param i64 i64 i64 i64 i32 i32) (result i32)))
 (import "env" "current_time" (func $~lib/as-chain/env/current_time (result i64)))
 (import "env" "db_remove_i64" (func $~lib/as-chain/env/db_remove_i64 (param i32)))
 (import "env" "db_lowerbound_i64" (func $~lib/as-chain/env/db_lowerbound_i64 (param i64 i64 i64 i64) (result i32)))
 (import "env" "db_end_i64" (func $~lib/as-chain/env/db_end_i64 (param i64 i64 i64) (result i32)))
 (import "env" "db_previous_i64" (func $~lib/as-chain/env/db_previous_i64 (param i32 i32) (result i32)))
 (import "env" "send_inline" (func $~lib/as-chain/env/send_inline (param i32 i32)))
 (import "env" "prints_l" (func $~lib/as-chain/env/prints_l (param i32 i32)))
 (global $~lib/rt/stub/offset (mut i32) (i32.const 0))
 (global $assembly/atomarb.contract/AMM_CONTRACT (mut i32) (i32.const 0))
 (global $assembly/atomarb.contract/TREASURY_CONTRACT (mut i32) (i32.const 0))
 (global $assembly/atomarb.contract/DEX_CONTRACT (mut i32) (i32.const 0))
 (global $~argumentsLength (mut i32) (i32.const 0))
 (memory $0 1)
 (data (i32.const 1036) "\1c")
 (data (i32.const 1048) "\03\00\00\00\08\00\00\00\01")
 (data (i32.const 1068) "<")
 (data (i32.const 1084) " \00\00\00.12345abcdefghijklmnopqrstuvwxyz")
 (data (i32.const 1132) ",")
 (data (i32.const 1144) "\04\00\00\00\10\00\00\00@\04\00\00@\04\00\00 \00\00\00 ")
 (data (i32.const 1180) "\dc")
 (data (i32.const 1192) "\01\00\00\00\cc\00\00\00F\00a\00i\00l\00e\00d\00 \00t\00o\00 \00\'\00s\00t\00o\00r\00e\00\'\00 \00v\00a\00l\00u\00e\00 \00a\00s\00 \00i\00t\00 \00a\00l\00r\00e\00a\00d\00y\00 \00e\00x\00i\00s\00t\00s\00,\00 \00p\00l\00e\00a\00s\00e\00 \00u\00s\00e\00 \00\'\00s\00e\00t\00\'\00 \00o\00r\00 \00\'\00u\00p\00d\00a\00t\00e\00\'\00 \00i\00f\00 \00y\00o\00u\00 \00w\00i\00s\00h\00 \00t\00o\00 \00u\00p\00d\00a\00t\00e\00 \00v\00a\00l\00u\00e")
 (data (i32.const 1404) "\dc")
 (data (i32.const 1416) "\01\00\00\00\c0\00\00\00F\00a\00i\00l\00e\00d\00 \00t\00o\00 \00\'\00u\00p\00d\00a\00t\00e\00\'\00 \00v\00a\00l\00u\00e\00 \00a\00s\00 \00i\00t\00e\00m\00 \00d\00o\00e\00s\00 \00n\00o\00t\00 \00e\00x\00i\00s\00t\00,\00 \00p\00l\00e\00a\00s\00e\00 \00u\00s\00e\00 \00\'\00s\00e\00t\00\'\00 \00o\00r\00 \00\'\00s\00t\00o\00r\00e\00\'\00 \00t\00o\00 \00s\00a\00v\00e\00 \00v\00a\00l\00u\00e\00 \00f\00i\00r\00s\00t")
 (data (i32.const 1628) "\dc")
 (data (i32.const 1640) "\01\00\00\00\c0\00\00\00F\00a\00i\00l\00e\00d\00 \00t\00o\00 \00\'\00r\00e\00m\00o\00v\00e\00\'\00 \00v\00a\00l\00u\00e\00 \00a\00s\00 \00i\00t\00e\00m\00 \00d\00o\00e\00s\00 \00n\00o\00t\00 \00e\00x\00i\00s\00t\00,\00 \00p\00l\00e\00a\00s\00e\00 \00u\00s\00e\00 \00\'\00s\00e\00t\00\'\00 \00o\00r\00 \00\'\00s\00t\00o\00r\00e\00\'\00 \00t\00o\00 \00s\00a\00v\00e\00 \00v\00a\00l\00u\00e\00 \00f\00i\00r\00s\00t")
 (data (i32.const 1852) "\8c")
 (data (i32.const 1864) "\01\00\00\00t\00\00\00F\00a\00i\00l\00e\00d\00 \00t\00o\00 \00f\00i\00n\00d\00 \00\'\00n\00e\00x\00t\00\'\00 \00v\00a\00l\00u\00e\00 \00a\00s\00 \00c\00u\00r\00r\00e\00n\00t\00 \00i\00t\00e\00m\00 \00d\00o\00e\00s\00 \00n\00o\00t\00 \00e\00x\00i\00s\00t")
 (data (i32.const 1996) "\8c")
 (data (i32.const 2008) "\01\00\00\00|\00\00\00F\00a\00i\00l\00e\00d\00 \00t\00o\00 \00f\00i\00n\00d\00 \00\'\00p\00r\00e\00v\00i\00o\00u\00s\00\'\00 \00v\00a\00l\00u\00e\00 \00a\00s\00 \00c\00u\00r\00r\00e\00n\00t\00 \00i\00t\00e\00m\00 \00d\00o\00e\00s\00 \00n\00o\00t\00 \00e\00x\00i\00s\00t")
 (data (i32.const 2140) "|")
 (data (i32.const 2152) "\01\00\00\00f\00\00\00n\00e\00x\00t\00 \00p\00r\00i\00m\00a\00r\00y\00 \00k\00e\00y\00 \00i\00n\00 \00t\00a\00b\00l\00e\00 \00i\00s\00 \00a\00t\00 \00a\00u\00t\00o\00i\00n\00c\00r\00e\00m\00e\00n\00t\00 \00l\00i\00m\00i\00t")
 (data (i32.const 2268) "\1c")
 (data (i32.const 2300) "\1c")
 (data (i32.const 2332) "\1c")
 (data (i32.const 2364) "\1c")
 (data (i32.const 2396) "\1c")
 (data (i32.const 2428) "\1c")
 (data (i32.const 2440) "\01")
 (data (i32.const 2460) "\1c")
 (data (i32.const 2492) "\1c")
 (data (i32.const 2524) "\1c")
 (data (i32.const 2556) "\\")
 (data (i32.const 2568) "\01\00\00\00>\00\00\00D\00e\00c\00o\00d\00e\00r\00.\00i\00n\00c\00P\00o\00s\00:\00 \00b\00u\00f\00f\00e\00r\00 \00o\00v\00e\00r\00f\00l\00o\00w")
 (data (i32.const 2652) "<")
 (data (i32.const 2664) "\01\00\00\00\1e\00\00\00u\00n\00e\00x\00p\00e\00c\00t\00e\00d\00 \00n\00u\00l\00l")
 (data (i32.const 2716) "L")
 (data (i32.const 2728) "\01\00\00\008\00\00\00O\00w\00n\00e\00r\00 \00a\00c\00c\00o\00u\00n\00t\00 \00d\00o\00e\00s\00 \00n\00o\00t\00 \00e\00x\00i\00s\00t")
 (data (i32.const 2796) "<")
 (data (i32.const 2808) "\01\00\00\00&\00\00\00u\00p\00d\00a\00t\00e\00:\00b\00a\00d\00 \00i\00t\00e\00r\00a\00t\00o\00r")
 (data (i32.const 2860) "L")
 (data (i32.const 2872) "\01\00\00\00:\00\00\00g\00e\00t\00 \00p\00r\00i\00m\00a\00r\00y\00:\00 \00i\00n\00v\00a\00l\00i\00d\00 \00i\00t\00e\00r\00a\00t\00o\00r")
 (data (i32.const 2940) "l")
 (data (i32.const 2952) "\01\00\00\00V\00\00\00p\00r\00i\00m\00a\00r\00y\00 \00k\00e\00y\00 \00c\00a\00n\00\'\00t\00 \00b\00e\00 \00c\00h\00a\00n\00g\00e\00d\00 \00d\00u\00r\00i\00n\00g\00 \00u\00p\00d\00a\00t\00e\00!")
 (data (i32.const 3052) "L")
 (data (i32.const 3064) "\01\00\00\002\00\00\00c\00h\00e\00c\00k\00P\00o\00s\00:\00 \00b\00u\00f\00f\00e\00r\00 \00o\00v\00e\00r\00f\00l\00o\00w")
 (data (i32.const 3132) "L")
 (data (i32.const 3144) "\01\00\00\00.\00\00\00i\00n\00c\00P\00o\00s\00:\00 \00b\00u\00f\00f\00e\00r\00 \00o\00v\00e\00r\00f\00l\00o\00w")
 (data (i32.const 3212) "<")
 (data (i32.const 3224) "\01\00\00\00&\00\00\00n\00o\00 \00s\00e\00c\00o\00n\00d\00a\00r\00y\00 \00v\00a\00l\00u\00e\00!")
 (data (i32.const 3276) "<")
 (data (i32.const 3288) "\01\00\00\00\1e\00\00\00N\00o\00t\00 \00i\00n\00i\00t\00i\00a\00l\00i\00z\00e\00d")
 (data (i32.const 3340) "<")
 (data (i32.const 3352) "\01\00\00\00\1e\00\00\00b\00a\00d\00 \00s\00y\00m\00b\00o\00l\00 \00n\00a\00m\00e")
 (data (i32.const 3404) "<")
 (data (i32.const 3416) "\01\00\00\00\"\00\00\00I\00n\00v\00a\00l\00i\00d\00 \00c\00h\00a\00r\00a\00c\00t\00e\00r")
 (data (i32.const 3468) "L")
 (data (i32.const 3480) "\01\00\00\000\00\00\00p\00r\00i\00m\00a\00r\00y\00 \00v\00a\00l\00u\00e\00 \00n\00o\00t\00 \00f\00o\00u\00n\00d\00!")
 (data (i32.const 3548) "<")
 (data (i32.const 3560) "\01\00\00\00,\00\00\00A\00c\00c\00o\00u\00n\00t\00 \00d\00o\00e\00s\00 \00n\00o\00t\00 \00e\00x\00i\00s\00t")
 (data (i32.const 3612) "<")
 (data (i32.const 3624) "\01\00\00\00&\00\00\00U\00s\00e\00r\00 \00n\00o\00t\00 \00a\00u\00t\00h\00o\00r\00i\00z\00e\00d")
 (data (i32.const 3676) "<")
 (data (i32.const 3688) "\01\00\00\00$\00\00\00C\00o\00n\00t\00r\00a\00c\00t\00 \00i\00s\00 \00p\00a\00u\00s\00e\00d")
 (data (i32.const 3740) "\1c")
 (data (i32.const 3772) "L")
 (data (i32.const 3784) "\01\00\00\00.\00\00\00n\00o\00 \00b\00a\00l\00a\00n\00c\00e\00 \00o\00b\00j\00e\00c\00t\00 \00f\00o\00u\00n\00d")
 (data (i32.const 3852) ",")
 (data (i32.const 3864) "\01\00\00\00\1c\00\00\00I\00n\00v\00a\00l\00i\00d\00 \00n\00a\00m\00e\00:\00 ")
 (data (i32.const 3900) "\1c")
 (data (i32.const 3912) "Q\00\00\00\0c\00\00\00 \0f\00\00\00\00\00\00\90\t")
 (data (i32.const 3932) ",")
 (data (i32.const 3944) "\01\00\00\00\1a\00\00\00i\00n\00v\00a\00l\00i\00d\00 \00n\00a\00m\00e\00 ")
 (data (i32.const 3980) "\1c")
 (data (i32.const 3992) "Q\00\00\00\0c\00\00\00p\0f\00\00\00\00\00\00\90\t")
 (data (i32.const 4012) ",")
 (data (i32.const 4024) "\01\00\00\00\10\00\00\00t\00r\00a\00n\00s\00f\00e\00r")
 (data (i32.const 4060) "\1c")
 (data (i32.const 4072) "\01\00\00\00\n\00\00\00X\00U\00S\00D\00C")
 (data (i32.const 4092) "L")
 (data (i32.const 4104) "\01\00\00\00.\00\00\00A\00m\00o\00u\00n\00t\00 \00m\00u\00s\00t\00 \00b\00e\00 \00i\00n\00 \00X\00U\00S\00D\00C")
 (data (i32.const 4172) "L")
 (data (i32.const 4184) "\01\00\00\00.\00\00\00A\00m\00o\00u\00n\00t\00 \00m\00u\00s\00t\00 \00b\00e\00 \00p\00o\00s\00i\00t\00i\00v\00e")
 (data (i32.const 4252) "\1c")
 (data (i32.const 4264) "\01\00\00\00\06\00\00\00X\00P\00R")
 (data (i32.const 4284) "<")
 (data (i32.const 4296) "\01\00\00\00,\00\00\00M\00i\00n\00 \00o\00u\00t\00p\00u\00t\00 \00m\00u\00s\00t\00 \00b\00e\00 \00X\00P\00R")
 (data (i32.const 4348) "\\")
 (data (i32.const 4360) "\01\00\00\00B\00\00\00T\00r\00a\00d\00e\00 \00e\00x\00c\00e\00e\00d\00s\00 \00m\00a\00x\00_\00t\00r\00a\00d\00e\00_\00u\00s\00d\00 \00l\00i\00m\00i\00t")
 (data (i32.const 4444) "l")
 (data (i32.const 4456) "\01\00\00\00V\00\00\00C\00o\00m\00p\00l\00e\00t\00e\00 \00o\00r\00 \00c\00a\00n\00c\00e\00l\00 \00e\00x\00i\00s\00t\00i\00n\00g\00 \00a\00r\00b\00i\00t\00r\00a\00g\00e\00 \00f\00i\00r\00s\00t")
 (data (i32.const 4556) "\1c")
 (data (i32.const 4568) "\01\00\00\00\06\00\00\00X\00M\00D")
 (data (i32.const 4588) ",")
 (data (i32.const 4600) "\01\00\00\00\10\00\00\00X\00P\00R\00U\00S\00D\00C\00,")
 (data (i32.const 4636) "\1c")
 (data (i32.const 4648) "\01\00\00\00\02\00\00\000")
 (data (i32.const 4668) "\\")
 (data (i32.const 4680) "\01\00\00\00H\00\00\000\001\002\003\004\005\006\007\008\009\00a\00b\00c\00d\00e\00f\00g\00h\00i\00j\00k\00l\00m\00n\00o\00p\00q\00r\00s\00t\00u\00v\00w\00x\00y\00z")
 (data (i32.const 4764) "\1c")
 (data (i32.const 4776) "\01\00\00\00\02\00\00\00.")
 (data (i32.const 4796) "\1c")
 (data (i32.const 4808) "\01\00\00\00\02\00\00\00 ")
 (data (i32.const 4828) "\1c")
 (data (i32.const 4840) "\01\00\00\00\08\00\00\00m\00i\00n\00t")
 (data (i32.const 4860) ",")
 (data (i32.const 4872) "\01\00\00\00\16\00\00\00M\00u\00s\00t\00 \00b\00e\00 \00X\00M\00D")
 (data (i32.const 4908) ",")
 (data (i32.const 4920) "\01\00\00\00\18\00\00\00r\00e\00d\00e\00e\00m\00,\00X\00U\00S\00D\00C")
 (data (i32.const 4956) ",")
 (data (i32.const 4968) "\01\00\00\00\16\00\00\00M\00u\00s\00t\00 \00b\00e\00 \00X\00P\00R")
 (data (i32.const 5004) "L")
 (data (i32.const 5016) "\01\00\00\000\00\00\00M\00i\00n\00 \00o\00u\00t\00p\00u\00t\00 \00m\00u\00s\00t\00 \00b\00e\00 \00X\00U\00S\00D\00C")
 (data (i32.const 5084) ",")
 (data (i32.const 5096) "\01\00\00\00\0e\00\00\00d\00e\00p\00o\00s\00i\00t")
 (data (i32.const 5132) ",")
 (data (i32.const 5144) "\01\00\00\00\14\00\00\00p\00l\00a\00c\00e\00o\00r\00d\00e\00r")
 (data (i32.const 5180) ",")
 (data (i32.const 5192) "\01\00\00\00\10\00\00\00w\00i\00t\00h\00d\00r\00a\00w")
 (data (i32.const 5228) "<")
 (data (i32.const 5240) "\01\00\00\00&\00\00\00N\00o\00 \00a\00c\00t\00i\00v\00e\00 \00a\00r\00b\00i\00t\00r\00a\00g\00e")
 (data (i32.const 5292) ",")
 (data (i32.const 5304) "\01\00\00\00\1a\00\00\00c\00h\00e\00c\00k\00b\00a\00l\00e\00x\00t\00:\00 ")
 (data (i32.const 5340) ",")
 (data (i32.const 5352) "\01\00\00\00\10\00\00\00 \00p\00r\00o\00f\00i\00t\00=")
 (data (i32.const 5388) ",")
 (data (i32.const 5400) "\01\00\00\00\14\00\00\00 \00r\00e\00q\00u\00i\00r\00e\00d\00=")
 (data (i32.const 5436) "<")
 (data (i32.const 5448) "\01\00\00\00 \00\00\00c\00h\00e\00c\00k\00b\00a\00l\00e\00x\00t\00 \00O\00K\00:\00 ")
 (data (i32.const 5500) "\\")
 (data (i32.const 5512) "\01\00\00\00B\00\00\00A\00r\00b\00i\00t\00r\00a\00g\00e\00 \00n\00o\00t\00 \00p\00r\00o\00f\00i\00t\00a\00b\00l\00e\00:\00 \00p\00r\00o\00f\00i\00t\00=")
 (data (i32.const 5596) "L")
 (data (i32.const 5608) "\01\00\00\00<\00\00\00A\00r\00b\00i\00t\00r\00a\00g\00e\00 \00s\00u\00c\00c\00e\00s\00s\00f\00u\00l\00!\00 \00P\00r\00o\00f\00i\00t\00:\00 ")
 (data (i32.const 5676) "|")
 (data (i32.const 5688) "\01\00\00\00b\00\00\00C\00l\00e\00a\00r\00 \00c\00a\00l\00l\00e\00d\00 \00-\00 \00i\00m\00p\00l\00e\00m\00e\00n\00t\00 \00t\00a\00b\00l\00e\00 \00c\00l\00e\00a\00r\00i\00n\00g\00 \00a\00s\00 \00n\00e\00e\00d\00e\00d")
 (data (i32.const 5804) "\\")
 (data (i32.const 5816) "\01\00\00\00H\00\00\00C\00o\00n\00f\00i\00g\00 \00c\00l\00e\00a\00r\00e\00d\00 \00-\00 \00c\00a\00n\00 \00n\00o\00w\00 \00c\00a\00l\00l\00 \00i\00n\00i\00t\00(\00)")
 (data (i32.const 5900) "\1c")
 (data (i32.const 5912) "\01\00\00\00\0c\00\00\00U\00s\00e\00r\00:\00 ")
 (data (i32.const 5932) ",")
 (data (i32.const 5944) "\01\00\00\00\14\00\00\00S\00t\00a\00r\00t\00i\00n\00g\00:\00 ")
 (data (i32.const 5980) ",")
 (data (i32.const 5992) "\01\00\00\00\18\00\00\00M\00i\00n\00 \00p\00r\00o\00f\00i\00t\00:\00 ")
 (data (i32.const 6028) ",")
 (data (i32.const 6040) "\01\00\00\00\0e\00\00\00R\00o\00u\00t\00e\00:\00 ")
 (data (i32.const 6076) "L")
 (data (i32.const 6088) "\01\00\00\008\00\00\00N\00o\00 \00a\00c\00t\00i\00v\00e\00 \00a\00r\00b\00i\00t\00r\00a\00g\00e\00 \00f\00o\00r\00 \00u\00s\00e\00r")
 (data (i32.const 6156) ",")
 (data (i32.const 6168) "\01\00\00\00\1c\00\00\00i\00n\00v\00a\00l\00i\00d\00 \00s\00y\00m\00b\00o\00l")
 (data (i32.const 6204) ",")
 (data (i32.const 6216) "\01\00\00\00\1a\00\00\00i\00n\00v\00a\00l\00i\00d\00 \00a\00s\00s\00e\00t")
 (table $0 2 funcref)
 (elem $0 (i32.const 1) $start:~lib/as-chain/name~anonymous|0)
 (export "apply" (func $assembly/atomarb.contract/apply))
 (export "memory" (memory $0))
 (start $~start)
 (func $start:~lib/as-chain/name~anonymous|0 (param $0 i32) (result i32)
  (local $1 i32)
  (if
   (select
    (i32.le_u
     (local.tee $1
      (i32.and
       (local.get $0)
       (i32.const 65535)
      )
     )
     (i32.const 122)
    )
    (i32.const 0)
    (i32.ge_u
     (local.get $1)
     (i32.const 97)
    )
   )
   (return
    (i32.sub
     (local.get $0)
     (i32.const 91)
    )
   )
  )
  (if
   (select
    (i32.le_u
     (local.tee $1
      (i32.and
       (local.get $0)
       (i32.const 65535)
      )
     )
     (i32.const 53)
    )
    (i32.const 0)
    (i32.ge_u
     (local.get $1)
     (i32.const 49)
    )
   )
   (return
    (i32.sub
     (local.get $0)
     (i32.const 48)
    )
   )
  )
  (if
   (i32.eq
    (i32.and
     (local.get $0)
     (i32.const 65535)
    )
    (i32.const 46)
   )
   (return
    (i32.const 0)
   )
  )
  (i32.const 65535)
 )
 (func $~lib/as-chain/name/Name#set:N (param $0 i32) (param $1 i64)
  (i64.store
   (local.get $0)
   (local.get $1)
  )
 )
 (func $~lib/rt/stub/maybeGrowMemory (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (if
   (i32.gt_u
    (local.get $0)
    (local.tee $1
     (i32.and
      (i32.add
       (i32.shl
        (local.tee $2
         (memory.size)
        )
        (i32.const 16)
       )
       (i32.const 15)
      )
      (i32.const -16)
     )
    )
   )
   (if
    (i32.lt_s
     (memory.grow
      (select
       (local.get $2)
       (local.tee $1
        (i32.shr_u
         (i32.and
          (i32.add
           (i32.sub
            (local.get $0)
            (local.get $1)
           )
           (i32.const 65535)
          )
          (i32.const -65536)
         )
         (i32.const 16)
        )
       )
       (i32.lt_s
        (local.get $1)
        (local.get $2)
       )
      )
     )
     (i32.const 0)
    )
    (if
     (i32.lt_s
      (memory.grow
       (local.get $1)
      )
      (i32.const 0)
     )
     (unreachable)
    )
   )
  )
  (global.set $~lib/rt/stub/offset
   (local.get $0)
  )
 )
 (func $~lib/rt/common/BLOCK#set:mmInfo (param $0 i32) (param $1 i32)
  (i32.store
   (local.get $0)
   (local.get $1)
  )
 )
 (func $~lib/rt/stub/__alloc (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (if
   (i32.gt_u
    (local.get $0)
    (i32.const 1073741820)
   )
   (unreachable)
  )
  (local.set $1
   (global.get $~lib/rt/stub/offset)
  )
  (call $~lib/rt/stub/maybeGrowMemory
   (i32.add
    (local.tee $2
     (i32.add
      (global.get $~lib/rt/stub/offset)
      (i32.const 4)
     )
    )
    (local.tee $0
     (i32.sub
      (i32.and
       (i32.add
        (local.get $0)
        (i32.const 19)
       )
       (i32.const -16)
      )
      (i32.const 4)
     )
    )
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $1)
   (local.get $0)
  )
  (local.get $2)
 )
 (func $~lib/rt/common/OBJECT#set:gcInfo (param $0 i32) (param $1 i32)
  (i32.store offset=4
   (local.get $0)
   (local.get $1)
  )
 )
 (func $~lib/rt/common/OBJECT#set:gcInfo2 (param $0 i32) (param $1 i32)
  (i32.store offset=8
   (local.get $0)
   (local.get $1)
  )
 )
 (func $~lib/rt/common/OBJECT#set:rtId (param $0 i32) (param $1 i32)
  (i32.store offset=12
   (local.get $0)
   (local.get $1)
  )
 )
 (func $~lib/rt/common/OBJECT#set:rtSize (param $0 i32) (param $1 i32)
  (i32.store offset=16
   (local.get $0)
   (local.get $1)
  )
 )
 (func $~lib/rt/stub/__new (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (if
   (i32.gt_u
    (local.get $0)
    (i32.const 1073741804)
   )
   (unreachable)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.tee $2
    (i32.sub
     (local.tee $3
      (call $~lib/rt/stub/__alloc
       (i32.add
        (local.get $0)
        (i32.const 16)
       )
      )
     )
     (i32.const 4)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $2)
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:rtId
   (local.get $2)
   (local.get $1)
  )
  (call $~lib/rt/common/OBJECT#set:rtSize
   (local.get $2)
   (local.get $0)
  )
  (i32.add
   (local.get $3)
   (i32.const 16)
  )
 )
 (func $assembly/atomarb.contract/ArbState#set:starting_balance (param $0 i32) (param $1 i64)
  (i64.store offset=8
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/ArbState#set:min_profit (param $0 i32) (param $1 i64)
  (i64.store offset=16
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/ArbState#set:route (param $0 i32) (param $1 i32)
  (i32.store8 offset=24
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/ArbState#set:base_symbol (param $0 i32) (param $1 i64)
  (i64.store offset=32
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/ArbState#set:quote_symbol (param $0 i32) (param $1 i64)
  (i64.store offset=40
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/ArbState#set:intermediate_symbol (param $0 i32) (param $1 i64)
  (i64.store offset=48
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/ArbState#set:started_at (param $0 i32) (param $1 i64)
  (i64.store offset=56
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/ArbState#constructor (param $0 i32) (param $1 i64) (param $2 i64) (param $3 i32) (param $4 i64) (param $5 i64) (param $6 i64) (param $7 i64) (result i32)
  (local $8 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $8
    (call $~lib/rt/stub/__new
     (i32.const 64)
     (i32.const 9)
    )
   )
   (local.get $0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $8)
   (local.get $1)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $8)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/ArbState#set:route
   (local.get $8)
   (local.get $3)
  )
  (call $assembly/atomarb.contract/ArbState#set:base_symbol
   (local.get $8)
   (local.get $4)
  )
  (call $assembly/atomarb.contract/ArbState#set:quote_symbol
   (local.get $8)
   (local.get $5)
  )
  (call $assembly/atomarb.contract/ArbState#set:intermediate_symbol
   (local.get $8)
   (local.get $6)
  )
  (call $assembly/atomarb.contract/ArbState#set:started_at
   (local.get $8)
   (local.get $7)
  )
  (local.get $8)
 )
 (func $assembly/atomarb.contract/ArbState#constructor@varargs (result i32)
  (local $0 i32)
  (block $8of8
   (block $0of8
    (block $outOfRange
     (br_table $0of8 $8of8 $8of8 $8of8 $8of8 $8of8 $8of8 $8of8 $8of8 $outOfRange
      (global.get $~argumentsLength)
     )
    )
    (unreachable)
   )
   (call $~lib/as-chain/name/Name#set:N
    (local.tee $0
     (call $~lib/rt/stub/__new
      (i32.const 8)
      (i32.const 5)
     )
    )
    (i64.const 0)
   )
   (call $~lib/as-chain/name/Name#set:N
    (local.get $0)
    (i64.const 0)
   )
  )
  (call $assembly/atomarb.contract/ArbState#constructor
   (local.get $0)
   (i64.const 0)
   (i64.const 0)
   (i32.const 0)
   (i64.const 0)
   (i64.const 0)
   (i64.const 0)
   (i64.const 0)
  )
 )
 (func $assembly/atomarb.contract/ArbState.get:tableName (result i32)
  (local $0 i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const 3877472402241748992)
  )
  (local.get $0)
 )
 (func $~lib/memory/memory.copy (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  (block $~lib/util/memory/memmove|inlined.0
   (local.set $4
    (local.get $2)
   )
   (br_if $~lib/util/memory/memmove|inlined.0
    (i32.eq
     (local.get $0)
     (local.get $1)
    )
   )
   (if
    (i32.lt_u
     (local.get $0)
     (local.get $1)
    )
    (loop $while-continue|0
     (if
      (local.get $4)
      (block
       (local.set $0
        (i32.add
         (local.tee $2
          (local.get $0)
         )
         (i32.const 1)
        )
       )
       (local.set $1
        (i32.add
         (local.tee $3
          (local.get $1)
         )
         (i32.const 1)
        )
       )
       (i32.store8
        (local.get $2)
        (i32.load8_u
         (local.get $3)
        )
       )
       (local.set $4
        (i32.sub
         (local.get $4)
         (i32.const 1)
        )
       )
       (br $while-continue|0)
      )
     )
    )
    (loop $while-continue|1
     (if
      (local.get $4)
      (block
       (i32.store8
        (i32.add
         (local.tee $4
          (i32.sub
           (local.get $4)
           (i32.const 1)
          )
         )
         (local.get $0)
        )
        (i32.load8_u
         (i32.add
          (local.get $1)
          (local.get $4)
         )
        )
       )
       (br $while-continue|1)
      )
     )
    )
   )
  )
 )
 (func $~lib/rt/__newArray (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (result i32)
  (local $4 i32)
  (local $5 i32)
  (local.set $5
   (local.tee $4
    (i32.shl
     (local.get $0)
     (local.get $1)
    )
   )
  )
  (local.set $1
   (call $~lib/rt/stub/__new
    (local.get $4)
    (i32.const 0)
   )
  )
  (if
   (local.get $3)
   (call $~lib/memory/memory.copy
    (local.get $1)
    (local.get $3)
    (local.get $5)
   )
  )
  (local.set $3
   (local.get $1)
  )
  (i32.store
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (local.get $2)
    )
   )
   (local.get $3)
  )
  (i32.store offset=4
   (local.get $1)
   (local.get $3)
  )
  (i32.store offset=8
   (local.get $1)
   (local.get $4)
  )
  (i32.store offset=12
   (local.get $1)
   (local.get $0)
  )
  (local.get $1)
 )
 (func $assembly/atomarb.contract/Config#set:paused (param $0 i32) (param $1 i32)
  (i32.store8 offset=4
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/Config#set:total_trades (param $0 i32) (param $1 i64)
  (i64.store offset=24
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/Config#constructor (param $0 i32) (result i32)
  (local $1 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 40)
     (i32.const 17)
    )
   )
   (local.get $0)
  )
  (call $assembly/atomarb.contract/Config#set:paused
   (local.get $1)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $1)
   (i64.const 5)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $1)
   (i64.const 100)
  )
  (call $assembly/atomarb.contract/Config#set:total_trades
   (local.get $1)
   (i64.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:base_symbol
   (local.get $1)
   (i64.const 0)
  )
  (local.get $1)
 )
 (func $assembly/atomarb.contract/Config#constructor@varargs (result i32)
  (local $0 i32)
  (block $6of6
   (block $0of6
    (block $outOfRange
     (br_table $0of6 $6of6 $6of6 $6of6 $6of6 $6of6 $6of6 $outOfRange
      (global.get $~argumentsLength)
     )
    )
    (unreachable)
   )
   (call $~lib/as-chain/name/Name#set:N
    (local.tee $0
     (call $~lib/rt/stub/__new
      (i32.const 8)
      (i32.const 5)
     )
    )
    (i64.const 0)
   )
   (call $~lib/as-chain/name/Name#set:N
    (local.get $0)
    (i64.const 0)
   )
  )
  (call $assembly/atomarb.contract/Config#constructor
   (local.get $0)
  )
 )
 (func $assembly/atomarb.contract/AuthorizedUser#constructor (param $0 i32) (param $1 i64) (result i32)
  (local $2 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 21)
    )
   )
   (local.get $0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $2)
   (local.get $1)
  )
  (local.get $2)
 )
 (func $assembly/atomarb.contract/AuthorizedUser#constructor@varargs (result i32)
  (local $0 i32)
  (block $2of2
   (block $0of2
    (block $outOfRange
     (br_table $0of2 $2of2 $2of2 $outOfRange
      (global.get $~argumentsLength)
     )
    )
    (unreachable)
   )
   (call $~lib/as-chain/name/Name#set:N
    (local.tee $0
     (call $~lib/rt/stub/__new
      (i32.const 8)
      (i32.const 5)
     )
    )
    (i64.const 0)
   )
   (call $~lib/as-chain/name/Name#set:N
    (local.get $0)
    (i64.const 0)
   )
  )
  (call $assembly/atomarb.contract/AuthorizedUser#constructor
   (local.get $0)
   (i64.const 0)
  )
 )
 (func $assembly/atomarb.contract/AuthorizedUser.get:tableName (result i32)
  (local $0 i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const 3941452720616128512)
  )
  (local.get $0)
 )
 (func $assembly/atomarb.contract/AtomArb#set:authorizedTable (param $0 i32) (param $1 i32)
  (i32.store offset=20
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/TradeRecord#set:route (param $0 i32) (param $1 i32)
  (i32.store8 offset=12
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/TradeRecord#constructor (param $0 i64) (param $1 i32) (param $2 i32) (param $3 i64) (param $4 i64) (param $5 i64) (param $6 i64) (param $7 i64) (param $8 i64) (result i32)
  (local $9 i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $9
    (call $~lib/rt/stub/__new
     (i32.const 64)
     (i32.const 25)
    )
   )
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $9)
   (local.get $1)
  )
  (call $assembly/atomarb.contract/TradeRecord#set:route
   (local.get $9)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $9)
   (local.get $3)
  )
  (call $assembly/atomarb.contract/Config#set:total_trades
   (local.get $9)
   (local.get $4)
  )
  (call $assembly/atomarb.contract/ArbState#set:base_symbol
   (local.get $9)
   (local.get $5)
  )
  (call $assembly/atomarb.contract/ArbState#set:quote_symbol
   (local.get $9)
   (local.get $6)
  )
  (call $assembly/atomarb.contract/ArbState#set:intermediate_symbol
   (local.get $9)
   (local.get $7)
  )
  (call $assembly/atomarb.contract/ArbState#set:started_at
   (local.get $9)
   (local.get $8)
  )
  (local.get $9)
 )
 (func $assembly/atomarb.contract/TradeRecord#constructor@varargs (result i32)
  (local $0 i32)
  (block $9of9
   (block $1of9
    (block $outOfRange
     (br_table $1of9 $1of9 $9of9 $9of9 $9of9 $9of9 $9of9 $9of9 $9of9 $9of9 $outOfRange
      (global.get $~argumentsLength)
     )
    )
    (unreachable)
   )
   (call $~lib/as-chain/name/Name#set:N
    (local.tee $0
     (call $~lib/rt/stub/__new
      (i32.const 8)
      (i32.const 5)
     )
    )
    (i64.const 0)
   )
   (call $~lib/as-chain/name/Name#set:N
    (local.get $0)
    (i64.const 0)
   )
  )
  (call $assembly/atomarb.contract/TradeRecord#constructor
   (i64.const 0)
   (local.get $0)
   (i32.const 0)
   (i64.const 0)
   (i64.const 0)
   (i64.const 0)
   (i64.const 0)
   (i64.const 0)
   (i64.const 0)
  )
 )
 (func $assembly/atomarb.contract/TradeRecord.get:tableName (result i32)
  (local $0 i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const -3617352161135951872)
  )
  (local.get $0)
 )
 (func $assembly/atomarb.contract/AtomArb#set:tradesTable (param $0 i32) (param $1 i32)
  (i32.store offset=24
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/TokenMap#constructor (param $0 i64) (param $1 i32) (param $2 i32) (result i32)
  (local $3 i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $3
    (call $~lib/rt/stub/__new
     (i32.const 13)
     (i32.const 29)
    )
   )
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $3)
   (local.get $1)
  )
  (call $assembly/atomarb.contract/TradeRecord#set:route
   (local.get $3)
   (local.get $2)
  )
  (local.get $3)
 )
 (func $assembly/atomarb.contract/TokenMap#constructor@varargs (result i32)
  (local $0 i32)
  (block $3of3
   (block $1of3
    (block $outOfRange
     (br_table $1of3 $1of3 $3of3 $3of3 $outOfRange
      (global.get $~argumentsLength)
     )
    )
    (unreachable)
   )
   (call $~lib/as-chain/name/Name#set:N
    (local.tee $0
     (call $~lib/rt/stub/__new
      (i32.const 8)
      (i32.const 5)
     )
    )
    (i64.const 0)
   )
   (call $~lib/as-chain/name/Name#set:N
    (local.get $0)
    (i64.const 0)
   )
  )
  (call $assembly/atomarb.contract/TokenMap#constructor
   (i64.const 0)
   (local.get $0)
   (i32.const 0)
  )
 )
 (func $assembly/atomarb.contract/TokenMap.get:tableName (result i32)
  (local $0 i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const -3665743416647483392)
  )
  (local.get $0)
 )
 (func $assembly/atomarb.contract/AmmPool#set:enabled (param $0 i32) (param $1 i32)
  (i32.store8 offset=40
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/AmmPool#constructor (param $0 i64) (param $1 i32) (param $2 i64) (param $3 i64) (param $4 i64) (result i32)
  (local $5 i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $5
    (call $~lib/rt/stub/__new
     (i32.const 41)
     (i32.const 33)
    )
   )
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $5)
   (local.get $1)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $5)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/Config#set:total_trades
   (local.get $5)
   (local.get $3)
  )
  (call $assembly/atomarb.contract/ArbState#set:base_symbol
   (local.get $5)
   (local.get $4)
  )
  (call $assembly/atomarb.contract/AmmPool#set:enabled
   (local.get $5)
   (i32.const 1)
  )
  (local.get $5)
 )
 (func $assembly/atomarb.contract/AmmPool.get:tableName (result i32)
  (local $0 i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const 3793537569900199936)
  )
  (local.get $0)
 )
 (func $assembly/atomarb.contract/DexMarket#set:enabled (param $0 i32) (param $1 i32)
  (i32.store8 offset=56
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/DexMarket#constructor (param $0 i64) (param $1 i64) (param $2 i32) (param $3 i64) (param $4 i64) (param $5 i64) (param $6 i64) (result i32)
  (local $7 i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $7
    (call $~lib/rt/stub/__new
     (i32.const 57)
     (i32.const 37)
    )
   )
   (local.get $0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $7)
   (local.get $1)
  )
  (call $~lib/rt/common/OBJECT#set:rtSize
   (local.get $7)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/Config#set:total_trades
   (local.get $7)
   (local.get $3)
  )
  (call $assembly/atomarb.contract/ArbState#set:base_symbol
   (local.get $7)
   (local.get $4)
  )
  (call $assembly/atomarb.contract/ArbState#set:quote_symbol
   (local.get $7)
   (local.get $5)
  )
  (call $assembly/atomarb.contract/ArbState#set:intermediate_symbol
   (local.get $7)
   (local.get $6)
  )
  (call $assembly/atomarb.contract/DexMarket#set:enabled
   (local.get $7)
   (i32.const 1)
  )
  (local.get $7)
 )
 (func $assembly/atomarb.contract/DexMarket.get:tableName (result i32)
  (local $0 i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const 5384936666266337280)
  )
  (local.get $0)
 )
 (func $assembly/atomarb.contract/LegBalance#constructor@varargs (result i32)
  (local $0 i32)
  (local $1 i32)
  (block $4of4
   (block $0of4
    (block $outOfRange
     (br_table $0of4 $4of4 $4of4 $4of4 $4of4 $outOfRange
      (global.get $~argumentsLength)
     )
    )
    (unreachable)
   )
   (call $~lib/as-chain/name/Name#set:N
    (local.tee $1
     (call $~lib/rt/stub/__new
      (i32.const 8)
      (i32.const 5)
     )
    )
    (i64.const 0)
   )
   (call $~lib/as-chain/name/Name#set:N
    (local.get $1)
    (i64.const 0)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 25)
     (i32.const 41)
    )
   )
   (local.get $1)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (i64.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $0)
   (i64.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:route
   (local.get $0)
   (i32.const 0)
  )
  (local.get $0)
 )
 (func $assembly/atomarb.contract/LegBalance.get:tableName (result i32)
  (local $0 i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const -8459885160576155648)
  )
  (local.get $0)
 )
 (func $assembly/atomarb.contract/AtomArb#set:legBalanceTable (param $0 i32) (param $1 i32)
  (i32.store offset=40
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/AtomArb#constructor (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i64)
  (local $7 i64)
  (local $8 i64)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (block (result i32)
    (if
     (i32.eqz
      (local.tee $3
       (call $~lib/rt/stub/__new
        (i32.const 44)
        (i32.const 7)
       )
      )
     )
     (local.set $3
      (call $~lib/rt/stub/__new
       (i32.const 12)
       (i32.const 8)
      )
     )
    )
    (local.get $3)
   )
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $3)
   (local.get $1)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $3)
   (local.get $2)
  )
  (local.set $2
   (i32.load
    (local.get $3)
   )
  )
  (global.set $~argumentsLength
   (i32.const 1)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 12)
    )
   )
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $1)
   (i64.const -1)
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (drop
   (call $assembly/atomarb.contract/ArbState#constructor@varargs)
  )
  (local.set $4
   (call $assembly/atomarb.contract/ArbState.get:tableName)
  )
  (drop
   (i64.load
    (call $assembly/atomarb.contract/ArbState.get:tableName)
   )
  )
  (local.set $5
   (call $~lib/rt/__newArray
    (i32.const 0)
    (i32.const 2)
    (i32.const 16)
    (i32.const 2288)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 13)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (i64.const -1)
  )
  (local.set $6
   (i64.load
    (local.get $2)
   )
  )
  (local.set $7
   (i64.load
    (local.get $2)
   )
  )
  (local.set $8
   (i64.load
    (local.get $4)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 14)
    )
   )
   (local.get $6)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $2)
   (local.get $7)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $2)
   (local.get $8)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $5)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $1)
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:rtId
   (local.get $3)
   (local.get $1)
  )
  (local.set $4
   (i32.load
    (local.get $3)
   )
  )
  (global.set $~argumentsLength
   (i32.const 1)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 12)
     (i32.const 18)
    )
   )
   (i64.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $1)
   (i32.const 0)
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (drop
   (call $assembly/atomarb.contract/Config#constructor@varargs)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 4982871454518345728)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $1)
   (i64.load
    (local.get $2)
   )
  )
  (global.set $~argumentsLength
   (i32.const 3)
  )
  (local.set $5
   (call $~lib/rt/__newArray
    (i32.const 0)
    (i32.const 2)
    (i32.const 16)
    (i32.const 2320)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 19)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (i64.const -1)
  )
  (local.set $6
   (i64.load
    (local.get $4)
   )
  )
  (local.set $7
   (i64.load
    (local.get $4)
   )
  )
  (local.set $8
   (i64.load
    (local.get $2)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 20)
    )
   )
   (local.get $6)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $2)
   (local.get $7)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $2)
   (local.get $8)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $5)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $1)
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:rtSize
   (local.get $3)
   (local.get $1)
  )
  (local.set $2
   (i32.load
    (local.get $3)
   )
  )
  (global.set $~argumentsLength
   (i32.const 1)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 22)
    )
   )
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $1)
   (i64.const -1)
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (drop
   (call $assembly/atomarb.contract/AuthorizedUser#constructor@varargs)
  )
  (local.set $4
   (call $assembly/atomarb.contract/AuthorizedUser.get:tableName)
  )
  (drop
   (i64.load
    (call $assembly/atomarb.contract/AuthorizedUser.get:tableName)
   )
  )
  (local.set $5
   (call $~lib/rt/__newArray
    (i32.const 0)
    (i32.const 2)
    (i32.const 16)
    (i32.const 2352)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 23)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (i64.const -1)
  )
  (local.set $6
   (i64.load
    (local.get $2)
   )
  )
  (local.set $7
   (i64.load
    (local.get $2)
   )
  )
  (local.set $8
   (i64.load
    (local.get $4)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 24)
    )
   )
   (local.get $6)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $2)
   (local.get $7)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $2)
   (local.get $8)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $5)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $1)
   (local.get $0)
  )
  (call $assembly/atomarb.contract/AtomArb#set:authorizedTable
   (local.get $3)
   (local.get $1)
  )
  (local.set $2
   (i32.load
    (local.get $3)
   )
  )
  (global.set $~argumentsLength
   (i32.const 1)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 26)
    )
   )
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $1)
   (i64.const -1)
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (drop
   (call $assembly/atomarb.contract/TradeRecord#constructor@varargs)
  )
  (local.set $4
   (call $assembly/atomarb.contract/TradeRecord.get:tableName)
  )
  (drop
   (i64.load
    (call $assembly/atomarb.contract/TradeRecord.get:tableName)
   )
  )
  (local.set $5
   (call $~lib/rt/__newArray
    (i32.const 0)
    (i32.const 2)
    (i32.const 16)
    (i32.const 2384)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 27)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (i64.const -1)
  )
  (local.set $6
   (i64.load
    (local.get $2)
   )
  )
  (local.set $7
   (i64.load
    (local.get $2)
   )
  )
  (local.set $8
   (i64.load
    (local.get $4)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 28)
    )
   )
   (local.get $6)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $2)
   (local.get $7)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $2)
   (local.get $8)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $5)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $1)
   (local.get $0)
  )
  (call $assembly/atomarb.contract/AtomArb#set:tradesTable
   (local.get $3)
   (local.get $1)
  )
  (local.set $2
   (i32.load
    (local.get $3)
   )
  )
  (global.set $~argumentsLength
   (i32.const 1)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 30)
    )
   )
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $1)
   (i64.const -1)
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (drop
   (call $assembly/atomarb.contract/TokenMap#constructor@varargs)
  )
  (local.set $4
   (call $assembly/atomarb.contract/TokenMap.get:tableName)
  )
  (drop
   (i64.load
    (call $assembly/atomarb.contract/TokenMap.get:tableName)
   )
  )
  (local.set $5
   (call $~lib/rt/__newArray
    (i32.const 0)
    (i32.const 2)
    (i32.const 16)
    (i32.const 2416)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 31)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (i64.const -1)
  )
  (local.set $6
   (i64.load
    (local.get $2)
   )
  )
  (local.set $7
   (i64.load
    (local.get $2)
   )
  )
  (local.set $8
   (i64.load
    (local.get $4)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 32)
    )
   )
   (local.get $6)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $2)
   (local.get $7)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $2)
   (local.get $8)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $5)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $1)
   (local.get $0)
  )
  (i32.store offset=28
   (local.get $3)
   (local.get $1)
  )
  (local.set $2
   (i32.load
    (local.get $3)
   )
  )
  (global.set $~argumentsLength
   (i32.const 1)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 34)
    )
   )
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $1)
   (i64.const -1)
  )
  (drop
   (call $assembly/atomarb.contract/AmmPool#constructor
    (i64.const 0)
    (i32.const 2448)
    (i64.const 0)
    (i64.const 0)
    (i64.const 20)
   )
  )
  (local.set $4
   (call $assembly/atomarb.contract/AmmPool.get:tableName)
  )
  (drop
   (i64.load
    (call $assembly/atomarb.contract/AmmPool.get:tableName)
   )
  )
  (local.set $5
   (call $~lib/rt/__newArray
    (i32.const 0)
    (i32.const 2)
    (i32.const 16)
    (i32.const 2480)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 35)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (i64.const -1)
  )
  (local.set $6
   (i64.load
    (local.get $2)
   )
  )
  (local.set $7
   (i64.load
    (local.get $2)
   )
  )
  (local.set $8
   (i64.load
    (local.get $4)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 36)
    )
   )
   (local.get $6)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $2)
   (local.get $7)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $2)
   (local.get $8)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $5)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $1)
   (local.get $0)
  )
  (i32.store offset=32
   (local.get $3)
   (local.get $1)
  )
  (local.set $2
   (i32.load
    (local.get $3)
   )
  )
  (global.set $~argumentsLength
   (i32.const 1)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 38)
    )
   )
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $1)
   (i64.const -1)
  )
  (drop
   (call $assembly/atomarb.contract/DexMarket#constructor
    (i64.const 0)
    (i64.const 0)
    (i32.const 2448)
    (i64.const 0)
    (i64.const 0)
    (i64.const 10)
    (i64.const 10)
   )
  )
  (local.set $4
   (call $assembly/atomarb.contract/DexMarket.get:tableName)
  )
  (drop
   (i64.load
    (call $assembly/atomarb.contract/DexMarket.get:tableName)
   )
  )
  (local.set $5
   (call $~lib/rt/__newArray
    (i32.const 0)
    (i32.const 2)
    (i32.const 16)
    (i32.const 2512)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 39)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (i64.const -1)
  )
  (local.set $6
   (i64.load
    (local.get $2)
   )
  )
  (local.set $7
   (i64.load
    (local.get $2)
   )
  )
  (local.set $8
   (i64.load
    (local.get $4)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 40)
    )
   )
   (local.get $6)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $2)
   (local.get $7)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $2)
   (local.get $8)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $5)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $1)
   (local.get $0)
  )
  (i32.store offset=36
   (local.get $3)
   (local.get $1)
  )
  (local.set $2
   (i32.load
    (local.get $3)
   )
  )
  (global.set $~argumentsLength
   (i32.const 1)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 42)
    )
   )
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $1)
   (i64.const -1)
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (drop
   (call $assembly/atomarb.contract/LegBalance#constructor@varargs)
  )
  (local.set $4
   (call $assembly/atomarb.contract/LegBalance.get:tableName)
  )
  (drop
   (i64.load
    (call $assembly/atomarb.contract/LegBalance.get:tableName)
   )
  )
  (local.set $5
   (call $~lib/rt/__newArray
    (i32.const 0)
    (i32.const 2)
    (i32.const 16)
    (i32.const 2544)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 43)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (i64.const -1)
  )
  (local.set $6
   (i64.load
    (local.get $2)
   )
  )
  (local.set $7
   (i64.load
    (local.get $2)
   )
  )
  (local.set $8
   (i64.load
    (local.get $4)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 44)
    )
   )
   (local.get $6)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $2)
   (local.get $7)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $2)
   (local.get $8)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $5)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $1)
   (local.get $0)
  )
  (call $assembly/atomarb.contract/AtomArb#set:legBalanceTable
   (local.get $3)
   (local.get $1)
  )
  (local.get $3)
 )
 (func $~lib/memory/memory.fill (param $0 i32) (param $1 i32)
  (local $2 i32)
  (loop $while-continue|0
   (if
    (local.get $1)
    (block
     (local.set $0
      (i32.add
       (local.tee $2
        (local.get $0)
       )
       (i32.const 1)
      )
     )
     (i32.store8
      (local.get $2)
      (i32.const 0)
     )
     (local.set $1
      (i32.sub
       (local.get $1)
       (i32.const 1)
      )
     )
     (br $while-continue|0)
    )
   )
  )
 )
 (func $~lib/array/Array<u8>#constructor (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 4)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $1)
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $1)
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:rtId
   (local.get $1)
   (i32.const 0)
  )
  (if
   (i32.gt_u
    (local.get $0)
    (i32.const 1073741820)
   )
   (unreachable)
  )
  (call $~lib/memory/memory.fill
   (local.tee $3
    (call $~lib/rt/stub/__new
     (local.tee $2
      (select
       (local.get $0)
       (i32.const 8)
       (i32.gt_u
        (local.get $0)
        (i32.const 8)
       )
      )
     )
     (i32.const 0)
    )
   )
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $1)
   (local.get $3)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $1)
   (local.get $3)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:rtId
   (local.get $1)
   (local.get $0)
  )
  (local.get $1)
 )
 (func $~lib/as-chain/serializer/Decoder#constructor (param $0 i32) (result i32)
  (local $1 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 47)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $1)
   (i32.const 0)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $1)
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $1)
   (i32.const 0)
  )
  (local.get $1)
 )
 (func $~lib/array/Array<u8>#slice (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (local $3 i32)
  (local.set $3
   (i32.load offset=12
    (local.get $0)
   )
  )
  (local.set $1
   (if (result i32)
    (i32.lt_s
     (local.get $1)
     (i32.const 0)
    )
    (select
     (local.tee $1
      (i32.add
       (local.get $1)
       (local.get $3)
      )
     )
     (i32.const 0)
     (i32.gt_s
      (local.get $1)
      (i32.const 0)
     )
    )
    (select
     (local.get $1)
     (local.get $3)
     (i32.lt_s
      (local.get $1)
      (local.get $3)
     )
    )
   )
  )
  (call $~lib/memory/memory.copy
   (i32.load offset=4
    (local.tee $3
     (call $~lib/rt/__newArray
      (local.tee $2
       (select
        (local.tee $2
         (i32.sub
          (if (result i32)
           (i32.lt_s
            (local.get $2)
            (i32.const 0)
           )
           (select
            (local.tee $2
             (i32.add
              (local.get $2)
              (local.get $3)
             )
            )
            (i32.const 0)
            (i32.gt_s
             (local.get $2)
             (i32.const 0)
            )
           )
           (select
            (local.get $2)
            (local.get $3)
            (i32.lt_s
             (local.get $2)
             (local.get $3)
            )
           )
          )
          (local.get $1)
         )
        )
        (i32.const 0)
        (i32.gt_s
         (local.get $2)
         (i32.const 0)
        )
       )
      )
      (i32.const 0)
      (i32.const 4)
      (i32.const 0)
     )
    )
   )
   (i32.add
    (i32.load offset=4
     (local.get $0)
    )
    (local.get $1)
   )
   (local.get $2)
  )
  (local.get $3)
 )
 (func $~lib/string/String.UTF8.byteLength (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local.set $4
   (i32.add
    (local.get $0)
    (i32.load offset=16
     (i32.sub
      (local.get $0)
      (i32.const 20)
     )
    )
   )
  )
  (local.set $2
   (i32.ne
    (local.get $1)
    (i32.const 0)
   )
  )
  (loop $while-continue|0
   (if
    (i32.lt_u
     (local.get $0)
     (local.get $4)
    )
    (block $while-break|0
     (local.set $2
      (if (result i32)
       (i32.lt_u
        (local.tee $3
         (i32.load16_u
          (local.get $0)
         )
        )
        (i32.const 128)
       )
       (block (result i32)
        (br_if $while-break|0
         (i32.and
          (local.get $1)
          (i32.eqz
           (local.get $3)
          )
         )
        )
        (i32.add
         (local.get $2)
         (i32.const 1)
        )
       )
       (if (result i32)
        (i32.lt_u
         (local.get $3)
         (i32.const 2048)
        )
        (i32.add
         (local.get $2)
         (i32.const 2)
        )
        (block (result i32)
         (if
          (select
           (i32.gt_u
            (local.get $4)
            (i32.add
             (local.get $0)
             (i32.const 2)
            )
           )
           (i32.const 0)
           (i32.eq
            (i32.and
             (local.get $3)
             (i32.const 64512)
            )
            (i32.const 55296)
           )
          )
          (if
           (i32.eq
            (i32.and
             (i32.load16_u offset=2
              (local.get $0)
             )
             (i32.const 64512)
            )
            (i32.const 56320)
           )
           (block
            (local.set $2
             (i32.add
              (local.get $2)
              (i32.const 4)
             )
            )
            (local.set $0
             (i32.add
              (local.get $0)
              (i32.const 4)
             )
            )
            (br $while-continue|0)
           )
          )
         )
         (i32.add
          (local.get $2)
          (i32.const 3)
         )
        )
       )
      )
     )
     (local.set $0
      (i32.add
       (local.get $0)
       (i32.const 2)
      )
     )
     (br $while-continue|0)
    )
   )
  )
  (local.get $2)
 )
 (func $~lib/string/String#get:length (param $0 i32) (result i32)
  (i32.shr_u
   (i32.load offset=16
    (i32.sub
     (local.get $0)
     (i32.const 20)
    )
   )
   (i32.const 1)
  )
 )
 (func $~lib/string/String.UTF8.encodeUnsafe (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local.set $4
   (i32.add
    (local.get $0)
    (i32.shl
     (local.get $1)
     (i32.const 1)
    )
   )
  )
  (local.set $1
   (local.get $2)
  )
  (loop $while-continue|0
   (if
    (i32.lt_u
     (local.get $0)
     (local.get $4)
    )
    (block
     (local.set $1
      (if (result i32)
       (i32.lt_u
        (local.tee $2
         (i32.load16_u
          (local.get $0)
         )
        )
        (i32.const 128)
       )
       (block (result i32)
        (i32.store8
         (local.get $1)
         (local.get $2)
        )
        (i32.add
         (local.get $1)
         (i32.const 1)
        )
       )
       (if (result i32)
        (i32.lt_u
         (local.get $2)
         (i32.const 2048)
        )
        (block (result i32)
         (i32.store16
          (local.get $1)
          (i32.or
           (i32.or
            (i32.shr_u
             (local.get $2)
             (i32.const 6)
            )
            (i32.const 192)
           )
           (i32.shl
            (i32.or
             (i32.and
              (local.get $2)
              (i32.const 63)
             )
             (i32.const 128)
            )
            (i32.const 8)
           )
          )
         )
         (i32.add
          (local.get $1)
          (i32.const 2)
         )
        )
        (block (result i32)
         (if
          (select
           (i32.gt_u
            (local.get $4)
            (i32.add
             (local.get $0)
             (i32.const 2)
            )
           )
           (i32.const 0)
           (i32.eq
            (i32.and
             (local.get $2)
             (i32.const 64512)
            )
            (i32.const 55296)
           )
          )
          (if
           (i32.eq
            (i32.and
             (local.tee $5
              (i32.load16_u offset=2
               (local.get $0)
              )
             )
             (i32.const 64512)
            )
            (i32.const 56320)
           )
           (block
            (i32.store
             (local.get $1)
             (i32.or
              (i32.or
               (i32.or
                (i32.shl
                 (i32.or
                  (i32.and
                   (local.tee $2
                    (i32.or
                     (i32.add
                      (i32.shl
                       (i32.and
                        (local.get $2)
                        (i32.const 1023)
                       )
                       (i32.const 10)
                      )
                      (i32.const 65536)
                     )
                     (i32.and
                      (local.get $5)
                      (i32.const 1023)
                     )
                    )
                   )
                   (i32.const 63)
                  )
                  (i32.const 128)
                 )
                 (i32.const 24)
                )
                (i32.shl
                 (i32.or
                  (i32.and
                   (i32.shr_u
                    (local.get $2)
                    (i32.const 6)
                   )
                   (i32.const 63)
                  )
                  (i32.const 128)
                 )
                 (i32.const 16)
                )
               )
               (i32.shl
                (i32.or
                 (i32.and
                  (i32.shr_u
                   (local.get $2)
                   (i32.const 12)
                  )
                  (i32.const 63)
                 )
                 (i32.const 128)
                )
                (i32.const 8)
               )
              )
              (i32.or
               (i32.shr_u
                (local.get $2)
                (i32.const 18)
               )
               (i32.const 240)
              )
             )
            )
            (local.set $1
             (i32.add
              (local.get $1)
              (i32.const 4)
             )
            )
            (local.set $0
             (i32.add
              (local.get $0)
              (i32.const 4)
             )
            )
            (br $while-continue|0)
           )
          )
         )
         (i32.store16
          (local.get $1)
          (i32.or
           (i32.or
            (i32.shr_u
             (local.get $2)
             (i32.const 12)
            )
            (i32.const 224)
           )
           (i32.shl
            (i32.or
             (i32.and
              (i32.shr_u
               (local.get $2)
               (i32.const 6)
              )
              (i32.const 63)
             )
             (i32.const 128)
            )
            (i32.const 8)
           )
          )
         )
         (i32.store8 offset=2
          (local.get $1)
          (i32.or
           (i32.and
            (local.get $2)
            (i32.const 63)
           )
           (i32.const 128)
          )
         )
         (i32.add
          (local.get $1)
          (i32.const 3)
         )
        )
       )
      )
     )
     (local.set $0
      (i32.add
       (local.get $0)
       (i32.const 2)
      )
     )
     (br $while-continue|0)
    )
   )
  )
  (if
   (local.get $3)
   (i32.store8
    (local.get $1)
    (i32.const 0)
   )
  )
 )
 (func $~lib/string/String.UTF8.encode (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $2
   (call $~lib/rt/stub/__new
    (call $~lib/string/String.UTF8.byteLength
     (local.get $0)
     (local.get $1)
    )
    (i32.const 0)
   )
  )
  (call $~lib/string/String.UTF8.encodeUnsafe
   (local.get $0)
   (call $~lib/string/String#get:length
    (local.get $0)
   )
   (local.get $2)
   (local.get $1)
  )
  (local.get $2)
 )
 (func $~lib/arraybuffer/ArrayBuffer#get:byteLength (param $0 i32) (result i32)
  (i32.load offset=16
   (i32.sub
    (local.get $0)
    (i32.const 20)
   )
  )
 )
 (func $~lib/dataview/DataView#constructor@varargs (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (block $2of2
   (block $1of2
    (block $outOfRange
     (br_table $1of2 $1of2 $2of2 $outOfRange
      (i32.sub
       (global.get $~argumentsLength)
       (i32.const 1)
      )
     )
    )
    (unreachable)
   )
   (local.set $2
    (call $~lib/arraybuffer/ArrayBuffer#get:byteLength
     (local.get $0)
    )
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 12)
     (i32.const 48)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $1)
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $1)
   (i32.const 0)
  )
  (if
   (i32.or
    (i32.lt_u
     (call $~lib/arraybuffer/ArrayBuffer#get:byteLength
      (local.get $0)
     )
     (local.get $2)
    )
    (i32.gt_u
     (local.get $2)
     (i32.const 1073741820)
    )
   )
   (unreachable)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $1)
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $1)
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $1)
   (local.get $2)
  )
  (local.get $1)
 )
 (func $~lib/as-chain/system/check (param $0 i32) (param $1 i32)
  (if
   (i32.eqz
    (local.get $0)
   )
   (block
    (local.set $0
     (call $~lib/string/String.UTF8.encode
      (local.get $1)
      (i32.const 1)
     )
    )
    (global.set $~argumentsLength
     (i32.const 1)
    )
    (call $~lib/as-chain/env/eosio_assert
     (i32.const 0)
     (i32.load offset=4
      (call $~lib/dataview/DataView#constructor@varargs
       (local.get $0)
      )
     )
    )
   )
  )
 )
 (func $~lib/as-chain/serializer/Decoder#incPos (param $0 i32) (param $1 i32)
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (i32.add
    (local.get $1)
    (i32.load offset=4
     (local.get $0)
    )
   )
  )
  (if
   (i32.gt_u
    (i32.load offset=4
     (local.get $0)
    )
    (i32.load offset=12
     (i32.load
      (local.get $0)
     )
    )
   )
   (call $~lib/as-chain/system/check
    (i32.const 0)
    (i32.const 2576)
   )
  )
 )
 (func $~lib/as-chain/serializer/Decoder#unpack (param $0 i32) (param $1 i32)
  (call $~lib/as-chain/serializer/Decoder#incPos
   (local.get $0)
   (call $~lib/as-chain/serializer/Packer#unpack@virtual
    (local.get $1)
    (call $~lib/array/Array<u8>#slice
     (i32.load
      (local.get $0)
     )
     (i32.load offset=4
      (local.get $0)
     )
     (i32.load offset=12
      (i32.load
       (local.get $0)
      )
     )
    )
   )
  )
 )
 (func $assembly/atomarb.contract/initAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $2
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $1)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $2)
   (local.get $1)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $1)
  )
  (i32.load offset=4
   (local.get $2)
  )
 )
 (func $~lib/as-chain/action/requireAuth (param $0 i32)
  (call $~lib/as-chain/env/require_auth
   (i64.load
    (local.get $0)
   )
  )
 )
 (func $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary (param $0 i32) (param $1 i32)
  (i32.store8 offset=8
   (local.get $0)
   (local.get $1)
  )
 )
 (func $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#constructor (param $0 i32) (param $1 i32) (param $2 i64) (param $3 i32) (result i32)
  (local $4 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $4
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 49)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (i32.const 0)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (i64.const 0)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $4)
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (local.get $1)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (local.get $2)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (local.get $3)
  )
  (local.get $4)
 )
 (func $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/Config>#find (param $0 i32) (param $1 i64) (result i32)
  (local $2 i32)
  (block $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/Config>#find (result i32)
   (if
    (i32.ge_s
     (local.tee $2
      (call $~lib/as-chain/env/db_find_i64
       (i64.load
        (local.tee $0
         (i32.load
          (local.get $0)
         )
        )
       )
       (i64.load offset=8
        (local.get $0)
       )
       (i64.load offset=16
        (local.get $0)
       )
       (local.get $1)
      )
     )
     (i32.const 0)
    )
    (br $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/Config>#find
     (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#constructor
      (local.get $0)
      (local.get $2)
      (local.get $1)
      (i32.const 1)
     )
    )
   )
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#constructor
    (local.get $0)
    (local.get $2)
    (i64.const 0)
    (i32.const 0)
   )
  )
 )
 (func $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk (param $0 i32) (result i32)
  (i32.ge_s
   (i32.load offset=4
    (local.get $0)
   )
   (i32.const 0)
  )
 )
 (func $~lib/as-chain/serializer/Decoder#unpackNumber<bool> (param $0 i32) (result i32)
  (local $1 i32)
  (local.set $1
   (i32.load8_u
    (i32.add
     (i32.load offset=4
      (i32.load
       (local.get $0)
      )
     )
     (i32.load offset=4
      (local.get $0)
     )
    )
   )
  )
  (call $~lib/as-chain/serializer/Decoder#incPos
   (local.get $0)
   (i32.const 1)
  )
  (local.get $1)
 )
 (func $~lib/as-chain/serializer/Decoder#unpackNumber<u64> (param $0 i32) (result i64)
  (local $1 i64)
  (local.set $1
   (i64.load
    (i32.add
     (i32.load offset=4
      (i32.load
       (local.get $0)
      )
     )
     (i32.load offset=4
      (local.get $0)
     )
    )
   )
  )
  (call $~lib/as-chain/serializer/Decoder#incPos
   (local.get $0)
   (i32.const 8)
  )
  (local.get $1)
 )
 (func $assembly/atomarb.contract/Config#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/Config#set:paused
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/Config#set:total_trades
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:base_symbol
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/Config>#getEx (param $0 i32) (param $1 i32) (result i32)
  (if
   (i32.eqz
    (local.tee $0
     (call $~lib/as-chain/env/db_get_i64
      (local.get $1)
      (i32.const 0)
      (i32.const 0)
     )
    )
   )
   (return
    (i32.const 0)
   )
  )
  (drop
   (call $~lib/as-chain/env/db_get_i64
    (local.get $1)
    (i32.load offset=4
     (local.tee $1
      (call $~lib/array/Array<u8>#constructor
       (local.get $0)
      )
     )
    )
    (local.get $0)
   )
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (drop
   (call $assembly/atomarb.contract/Config#unpack
    (local.tee $0
     (call $assembly/atomarb.contract/Config#constructor@varargs)
    )
    (local.get $1)
   )
  )
  (local.get $0)
 )
 (func $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#getValue (param $0 i32) (result i32)
  (if
   (i32.eqz
    (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
     (local.get $0)
    )
   )
   (return
    (i32.const 0)
   )
  )
  (call $~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/Config>#getEx
   (i32.load
    (local.get $0)
   )
   (i32.load offset=4
    (local.get $0)
   )
  )
 )
 (func $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#get (param $0 i32) (result i32)
  (if
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
    (local.tee $0
     (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/Config>#find
      (i32.load offset=8
       (local.get $0)
      )
      (i64.load
       (local.get $0)
      )
     )
    )
   )
   (block
    (if
     (i32.eqz
      (local.tee $0
       (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#getValue
        (local.get $0)
       )
      )
     )
     (unreachable)
    )
    (return
     (local.get $0)
    )
   )
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/Config#constructor@varargs)
 )
 (func $~lib/as-chain/action/isAccount (param $0 i32) (result i32)
  (call $~lib/as-chain/env/is_account
   (i64.load
    (local.get $0)
   )
  )
 )
 (func $assembly/atomarb.contract/Config#getPrimaryValue (result i64)
  (local $0 i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const 4982871454518345728)
  )
  (i64.load
   (local.get $0)
  )
 )
 (func $~lib/as-chain/serializer/Encoder#constructor (param $0 i32) (result i32)
  (local $1 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 50)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $1)
   (i32.const 0)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $1)
   (call $~lib/array/Array<u8>#constructor
    (local.get $0)
   )
  )
  (local.get $1)
 )
 (func $~lib/as-chain/serializer/Encoder#incPos (param $0 i32) (param $1 i32)
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (i32.add
    (local.get $1)
    (i32.load offset=4
     (local.get $0)
    )
   )
  )
  (if
   (i32.gt_u
    (i32.load offset=4
     (local.get $0)
    )
    (i32.load offset=12
     (i32.load
      (local.get $0)
     )
    )
   )
   (call $~lib/as-chain/system/check
    (i32.const 0)
    (i32.const 3152)
   )
  )
 )
 (func $~lib/as-chain/serializer/Encoder#pack (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local.set $1
   (i32.load offset=12
    (local.tee $2
     (call $~lib/as-chain/serializer/Packer#pack@virtual
      (local.get $1)
     )
    )
   )
  )
  (if
   (i32.lt_u
    (i32.load offset=12
     (i32.load
      (local.get $0)
     )
    )
    (i32.add
     (local.get $1)
     (i32.load offset=4
      (local.get $0)
     )
    )
   )
   (call $~lib/as-chain/system/check
    (i32.const 0)
    (i32.const 3072)
   )
  )
  (local.set $2
   (i32.load offset=4
    (local.get $2)
   )
  )
  (local.set $3
   (i32.load offset=4
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#incPos
   (local.get $0)
   (local.get $1)
  )
  (drop
   (call $~lib/as-chain/env/memcpy
    (i32.add
     (local.get $3)
     (i32.load offset=4
      (i32.load
       (local.get $0)
      )
     )
    )
    (local.get $2)
    (local.get $1)
   )
  )
 )
 (func $~lib/as-chain/serializer/Encoder#packNumber<bool> (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local.set $2
   (i32.load offset=4
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#incPos
   (local.get $0)
   (i32.const 1)
  )
  (i32.store8
   (i32.add
    (local.get $2)
    (i32.load offset=4
     (i32.load
      (local.get $0)
     )
    )
   )
   (local.get $1)
  )
 )
 (func $~lib/as-chain/serializer/Encoder#packNumber<u64> (param $0 i32) (param $1 i64)
  (local $2 i32)
  (local.set $2
   (i32.load offset=4
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#incPos
   (local.get $0)
   (i32.const 8)
  )
  (i64.store
   (i32.add
    (local.get $2)
    (i32.load offset=4
     (i32.load
      (local.get $0)
     )
    )
   )
   (local.get $1)
  )
 )
 (func $~lib/as-chain/serializer/Encoder#getBytes (param $0 i32) (result i32)
  (call $~lib/array/Array<u8>#slice
   (i32.load
    (local.get $0)
   )
   (i32.const 0)
   (i32.load offset=4
    (local.get $0)
   )
  )
 )
 (func $assembly/atomarb.contract/Config#pack (param $0 i32) (result i32)
  (local $1 i32)
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.tee $1
    (call $~lib/as-chain/serializer/Encoder#constructor
     (block (result i32)
      (drop
       (i32.load
        (local.get $0)
       )
      )
      (i32.const 41)
     )
    )
   )
   (i32.load
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
   (local.get $1)
   (i32.load8_u offset=4
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=8
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=16
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=24
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=32
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#getBytes
   (local.get $1)
  )
 )
 (func $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get (param $0 i32) (param $1 i32) (result i32)
  (if
   (i32.ge_u
    (local.get $1)
    (i32.load offset=12
     (local.get $0)
    )
   )
   (unreachable)
  )
  (if
   (i32.eqz
    (local.tee $0
     (i32.load
      (i32.add
       (i32.load offset=4
        (local.get $0)
       )
       (i32.shl
        (local.get $1)
        (i32.const 2)
       )
      )
     )
    )
   )
   (unreachable)
  )
  (local.get $0)
 )
 (func $assembly/atomarb.contract/Config#getSecondaryValue (result i32)
  (local $0 i32)
  (local $1 i32)
  (call $~lib/as-chain/system/check
   (i32.const 0)
   (i32.const 3232)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 54)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $0)
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:rtId
   (local.get $0)
   (i32.const 0)
  )
  (call $~lib/memory/memory.fill
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 64)
     (i32.const 0)
    )
   )
   (i32.const 64)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $1)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $1)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $0)
   (i32.const 64)
  )
  (call $~lib/rt/common/OBJECT#set:rtId
   (local.get $0)
   (i32.const 0)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 53)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $1)
   (local.get $0)
  )
  (local.get $1)
 )
 (func $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/Config>#update (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32)
  (local $4 i32)
  (local $5 i64)
  (local $6 i32)
  (local $7 i64)
  (call $~lib/as-chain/system/check
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
    (local.get $1)
   )
   (i32.const 2816)
  )
  (call $~lib/as-chain/system/check
   (i64.eq
    (local.tee $5
     (call $assembly/atomarb.contract/Config#getPrimaryValue)
    )
    (block $__inlined_func$~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#get:primary (result i64)
     (call $~lib/as-chain/system/check
      (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
       (local.get $1)
      )
      (i32.const 2880)
     )
     (if
      (i32.load8_u offset=8
       (local.get $1)
      )
      (br $__inlined_func$~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#get:primary
       (i64.load offset=16
        (local.get $1)
       )
      )
     )
     (if
      (i32.eqz
       (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#getValue
        (local.get $1)
       )
      )
      (unreachable)
     )
     (call $assembly/atomarb.contract/ArbState#set:min_profit
      (local.get $1)
      (call $assembly/atomarb.contract/Config#getPrimaryValue)
     )
     (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
      (local.get $1)
      (i32.const 1)
     )
     (i64.load offset=16
      (local.get $1)
     )
    )
   )
   (i32.const 2960)
  )
  (drop
   (i32.load
    (local.get $0)
   )
  )
  (local.set $7
   (i64.load
    (local.get $3)
   )
  )
  (local.set $6
   (i32.load offset=12
    (local.tee $2
     (call $assembly/atomarb.contract/Config#pack
      (local.get $2)
     )
    )
   )
  )
  (call $~lib/as-chain/env/db_update_i64
   (i32.load offset=4
    (local.get $1)
   )
   (local.get $7)
   (i32.load offset=4
    (local.get $2)
   )
   (local.get $6)
  )
  (loop $for-loop|0
   (if
    (i32.lt_s
     (local.get $4)
     (i32.load offset=12
      (i32.load offset=4
       (local.get $0)
      )
     )
    )
    (block
     (local.set $1
      (call $~lib/as-chain/idxdb/IDXDB#findPrimaryEx@virtual
       (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
        (i32.load offset=4
         (local.get $0)
        )
        (local.get $4)
       )
      )
     )
     (local.set $2
      (call $assembly/atomarb.contract/Config#getSecondaryValue)
     )
     (if
      (i32.eqz
       (if (result i32)
        (i32.eq
         (i32.load
          (i32.load offset=4
           (local.get $1)
          )
         )
         (i32.load
          (local.get $2)
         )
        )
        (i32.eq
         (i32.load offset=4
          (i32.load offset=4
           (local.get $1)
          )
         )
         (i32.load offset=4
          (local.get $2)
         )
        )
        (i32.const 0)
       )
      )
      (block
       (local.set $0
        (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
         (i32.load offset=4
          (local.get $0)
         )
         (local.get $4)
        )
       )
       (drop
        (i32.load
         (local.get $1)
        )
       )
       (drop
        (call $assembly/atomarb.contract/Config#getSecondaryValue)
       )
       (drop
        (i64.load
         (local.get $3)
        )
       )
       (drop
        (i32.load
         (i32.sub
          (local.get $0)
          (i32.const 8)
         )
        )
       )
       (unreachable)
      )
     )
     (local.set $4
      (i32.add
       (local.get $4)
       (i32.const 1)
      )
     )
     (br $for-loop|0)
    )
   )
  )
  (if
   (i64.ge_u
    (local.get $5)
    (i64.load offset=8
     (local.get $0)
    )
   )
   (call $assembly/atomarb.contract/ArbState#set:starting_balance
    (local.get $0)
    (select
     (i64.const -2)
     (i64.add
      (local.get $5)
      (i64.const 1)
     )
     (i64.ge_u
      (local.get $5)
      (i64.const -2)
     )
    )
   )
  )
 )
 (func $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#set (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i64)
  (local $5 i32)
  (local $6 i64)
  (local $7 i32)
  (if
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
    (local.tee $3
     (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/Config>#find
      (i32.load offset=8
       (local.get $0)
      )
      (i64.load
       (local.get $0)
      )
     )
    )
   )
   (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/Config>#update
    (i32.load offset=8
     (local.get $0)
    )
    (local.get $3)
    (local.get $1)
    (local.get $2)
   )
   (block
    (local.set $3
     (i32.const 0)
    )
    (local.set $5
     (i32.load
      (local.tee $0
       (i32.load offset=8
        (local.get $0)
       )
      )
     )
    )
    (local.set $4
     (call $assembly/atomarb.contract/Config#getPrimaryValue)
    )
    (local.set $6
     (i64.load
      (local.get $2)
     )
    )
    (local.set $7
     (i32.load offset=12
      (local.tee $1
       (call $assembly/atomarb.contract/Config#pack
        (local.get $1)
       )
      )
     )
    )
    (drop
     (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#constructor
      (local.get $5)
      (call $~lib/as-chain/env/db_store_i64
       (i64.load offset=8
        (local.get $5)
       )
       (i64.load offset=16
        (local.get $5)
       )
       (local.get $6)
       (local.get $4)
       (i32.load offset=4
        (local.get $1)
       )
       (local.get $7)
      )
      (local.get $4)
      (i32.const 1)
     )
    )
    (loop $for-loop|0
     (if
      (i32.lt_s
       (local.get $3)
       (i32.load offset=12
        (i32.load offset=4
         (local.get $0)
        )
       )
      )
      (block
       (call $~lib/as-chain/idxdb/IDXDB#storeEx@virtual
        (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
         (i32.load offset=4
          (local.get $0)
         )
         (local.get $3)
        )
        (call $assembly/atomarb.contract/Config#getPrimaryValue)
        (call $assembly/atomarb.contract/Config#getSecondaryValue)
        (i64.load
         (local.get $2)
        )
       )
       (local.set $3
        (i32.add
         (local.get $3)
         (i32.const 1)
        )
       )
       (br $for-loop|0)
      )
     )
    )
    (if
     (i64.ge_u
      (local.tee $4
       (call $assembly/atomarb.contract/Config#getPrimaryValue)
      )
      (i64.load offset=8
       (local.get $0)
      )
     )
     (call $assembly/atomarb.contract/ArbState#set:starting_balance
      (local.get $0)
      (select
       (i64.const -2)
       (i64.add
        (local.get $4)
        (i64.const 1)
       )
       (i64.ge_u
        (local.get $4)
        (i64.const -2)
       )
      )
     )
    )
   )
  )
 )
 (func $~lib/as-chain/time/Microseconds#constructor (param $0 i64) (result i32)
  (local $1 i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 56)
    )
   )
   (local.get $0)
  )
  (local.get $1)
 )
 (func $~lib/as-chain/system/currentTimeSec (result i32)
  (local $0 i32)
  (local $1 i64)
  (local.set $1
   (call $~lib/as-chain/env/current_time)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 4)
     (i32.const 55)
    )
   )
   (call $~lib/as-chain/time/Microseconds#constructor
    (i64.const 0)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (call $~lib/as-chain/time/Microseconds#constructor
    (local.get $1)
   )
  )
  (i32.wrap_i64
   (i64.div_s
    (i64.load
     (i32.load
      (local.get $0)
     )
    )
    (i64.const 1000000)
   )
  )
 )
 (func $assembly/atomarb.contract/AuthorizedUser#getPrimaryValue (param $0 i32) (result i64)
  (i64.load
   (i32.load
    (local.get $0)
   )
  )
 )
 (func $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/AuthorizedUser>#constructor (param $0 i32) (param $1 i32) (param $2 i64) (param $3 i32) (result i32)
  (local $4 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $4
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 57)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (i32.const 0)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (i64.const 0)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $4)
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (local.get $1)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (local.get $2)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (local.get $3)
  )
  (local.get $4)
 )
 (func $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/AuthorizedUser>#find (param $0 i32) (param $1 i64) (result i32)
  (local $2 i32)
  (block $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/AuthorizedUser>#find (result i32)
   (if
    (i32.ge_s
     (local.tee $2
      (call $~lib/as-chain/env/db_find_i64
       (i64.load
        (local.tee $0
         (i32.load
          (local.get $0)
         )
        )
       )
       (i64.load offset=8
        (local.get $0)
       )
       (i64.load offset=16
        (local.get $0)
       )
       (local.get $1)
      )
     )
     (i32.const 0)
    )
    (br $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/AuthorizedUser>#find
     (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/AuthorizedUser>#constructor
      (local.get $0)
      (local.get $2)
      (local.get $1)
      (i32.const 1)
     )
    )
   )
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/AuthorizedUser>#constructor
    (local.get $0)
    (local.get $2)
    (i64.const 0)
    (i32.const 0)
   )
  )
 )
 (func $assembly/atomarb.contract/AuthorizedUser#pack (param $0 i32) (result i32)
  (local $1 i32)
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.tee $1
    (call $~lib/as-chain/serializer/Encoder#constructor
     (block (result i32)
      (drop
       (i32.load
        (local.get $0)
       )
      )
      (i32.const 16)
     )
    )
   )
   (i32.load
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=8
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#getBytes
   (local.get $1)
  )
 )
 (func $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AuthorizedUser>#store (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i64)
  (local $4 i64)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i64)
  (local $9 i32)
  (local $10 i32)
  (local.set $4
   (call $assembly/atomarb.contract/AuthorizedUser#getPrimaryValue
    (local.get $1)
   )
  )
  (call $~lib/as-chain/system/check
   (i32.eqz
    (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
     (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/AuthorizedUser>#find
      (i32.load
       (local.get $0)
      )
      (local.get $4)
     )
    )
   )
   (i32.const 1200)
  )
  (local.set $7
   (i32.load
    (local.tee $6
     (i32.load
      (local.get $0)
     )
    )
   )
  )
  (local.set $3
   (call $assembly/atomarb.contract/AuthorizedUser#getPrimaryValue
    (local.get $1)
   )
  )
  (local.set $8
   (i64.load
    (local.get $2)
   )
  )
  (local.set $10
   (i32.load offset=12
    (local.tee $9
     (call $assembly/atomarb.contract/AuthorizedUser#pack
      (local.get $1)
     )
    )
   )
  )
  (drop
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/AuthorizedUser>#constructor
    (local.get $7)
    (call $~lib/as-chain/env/db_store_i64
     (i64.load offset=8
      (local.get $7)
     )
     (i64.load offset=16
      (local.get $7)
     )
     (local.get $8)
     (local.get $3)
     (i32.load offset=4
      (local.get $9)
     )
     (local.get $10)
    )
    (local.get $3)
    (i32.const 1)
   )
  )
  (loop $for-loop|0
   (if
    (i32.lt_s
     (local.get $5)
     (i32.load offset=12
      (i32.load offset=4
       (local.get $6)
      )
     )
    )
    (block
     (call $~lib/as-chain/idxdb/IDXDB#storeEx@virtual
      (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
       (i32.load offset=4
        (local.get $6)
       )
       (local.get $5)
      )
      (call $assembly/atomarb.contract/AuthorizedUser#getPrimaryValue
       (local.get $1)
      )
      (call $assembly/atomarb.contract/Config#getSecondaryValue)
      (i64.load
       (local.get $2)
      )
     )
     (local.set $5
      (i32.add
       (local.get $5)
       (i32.const 1)
      )
     )
     (br $for-loop|0)
    )
   )
  )
  (if
   (i64.ge_u
    (local.tee $3
     (call $assembly/atomarb.contract/AuthorizedUser#getPrimaryValue
      (local.get $1)
     )
    )
    (i64.load offset=8
     (local.get $6)
    )
   )
   (call $assembly/atomarb.contract/ArbState#set:starting_balance
    (local.get $6)
    (select
     (i64.const -2)
     (i64.add
      (local.get $3)
      (i64.const 1)
     )
     (i64.ge_u
      (local.get $3)
      (i64.const -2)
     )
    )
   )
  )
  (if
   (i64.ge_u
    (local.get $4)
    (i64.load offset=8
     (local.get $0)
    )
   )
   (call $assembly/atomarb.contract/ArbState#set:starting_balance
    (local.get $0)
    (select
     (i64.const -2)
     (i64.add
      (local.get $4)
      (i64.const 1)
     )
     (i64.ge_u
      (local.get $4)
      (i64.const -2)
     )
    )
   )
  )
 )
 (func $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/TokenMap>#constructor (param $0 i32) (param $1 i32) (param $2 i64) (param $3 i32) (result i32)
  (local $4 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $4
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 58)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (i32.const 0)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (i64.const 0)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $4)
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (local.get $1)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (local.get $2)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (local.get $3)
  )
  (local.get $4)
 )
 (func $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/TokenMap>#find (param $0 i32) (param $1 i64) (result i32)
  (local $2 i32)
  (block $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/TokenMap>#find (result i32)
   (if
    (i32.ge_s
     (local.tee $2
      (call $~lib/as-chain/env/db_find_i64
       (i64.load
        (local.tee $0
         (i32.load
          (local.get $0)
         )
        )
       )
       (i64.load offset=8
        (local.get $0)
       )
       (i64.load offset=16
        (local.get $0)
       )
       (local.get $1)
      )
     )
     (i32.const 0)
    )
    (br $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/TokenMap>#find
     (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/TokenMap>#constructor
      (local.get $0)
      (local.get $2)
      (local.get $1)
      (i32.const 1)
     )
    )
   )
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/TokenMap>#constructor
    (local.get $0)
    (local.get $2)
    (i64.const 0)
    (i32.const 0)
   )
  )
 )
 (func $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TokenMap>#exists (param $0 i32) (param $1 i64) (result i32)
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
   (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/TokenMap>#find
    (i32.load
     (local.get $0)
    )
    (local.get $1)
   )
  )
 )
 (func $assembly/atomarb.contract/TokenMap#pack (param $0 i32) (result i32)
  (local $1 i32)
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.tee $1
    (call $~lib/as-chain/serializer/Encoder#constructor
     (block (result i32)
      (drop
       (i32.load offset=8
        (local.get $0)
       )
      )
      (i32.const 17)
     )
    )
   )
   (i64.load
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (i32.load offset=8
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
   (local.get $1)
   (i32.load8_u offset=12
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#getBytes
   (local.get $1)
  )
 )
 (func $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TokenMap>#store (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i64)
  (local $4 i32)
  (local $5 i32)
  (local $6 i64)
  (local $7 i32)
  (local $8 i64)
  (local $9 i32)
  (local $10 i32)
  (call $~lib/as-chain/system/check
   (i32.eqz
    (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
     (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/TokenMap>#find
      (i32.load
       (local.get $0)
      )
      (local.tee $6
       (i64.load
        (local.get $1)
       )
      )
     )
    )
   )
   (i32.const 1200)
  )
  (local.set $3
   (i64.load
    (local.get $1)
   )
  )
  (local.set $8
   (i64.load
    (local.get $2)
   )
  )
  (local.set $7
   (i32.load
    (local.tee $5
     (i32.load
      (local.get $0)
     )
    )
   )
  )
  (local.set $10
   (i32.load offset=12
    (local.tee $9
     (call $assembly/atomarb.contract/TokenMap#pack
      (local.get $1)
     )
    )
   )
  )
  (drop
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/TokenMap>#constructor
    (local.get $7)
    (call $~lib/as-chain/env/db_store_i64
     (i64.load offset=8
      (local.get $7)
     )
     (i64.load offset=16
      (local.get $7)
     )
     (local.get $8)
     (local.get $3)
     (i32.load offset=4
      (local.get $9)
     )
     (local.get $10)
    )
    (local.get $3)
    (i32.const 1)
   )
  )
  (loop $for-loop|0
   (if
    (i32.lt_s
     (local.get $4)
     (i32.load offset=12
      (i32.load offset=4
       (local.get $5)
      )
     )
    )
    (block
     (call $~lib/as-chain/idxdb/IDXDB#storeEx@virtual
      (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
       (i32.load offset=4
        (local.get $5)
       )
       (local.get $4)
      )
      (i64.load
       (local.get $1)
      )
      (call $assembly/atomarb.contract/Config#getSecondaryValue)
      (i64.load
       (local.get $2)
      )
     )
     (local.set $4
      (i32.add
       (local.get $4)
       (i32.const 1)
      )
     )
     (br $for-loop|0)
    )
   )
  )
  (if
   (i64.ge_u
    (local.tee $3
     (i64.load
      (local.get $1)
     )
    )
    (i64.load offset=8
     (local.get $5)
    )
   )
   (call $assembly/atomarb.contract/ArbState#set:starting_balance
    (local.get $5)
    (select
     (i64.const -2)
     (i64.add
      (local.get $3)
      (i64.const 1)
     )
     (i64.ge_u
      (local.get $3)
      (i64.const -2)
     )
    )
   )
  )
  (if
   (i64.ge_u
    (local.get $6)
    (i64.load offset=8
     (local.get $0)
    )
   )
   (call $assembly/atomarb.contract/ArbState#set:starting_balance
    (local.get $0)
    (select
     (i64.const -2)
     (i64.add
      (local.get $6)
      (i64.const 1)
     )
     (i64.ge_u
      (local.get $6)
      (i64.const -2)
     )
    )
   )
  )
 )
 (func $assembly/atomarb.contract/AtomArb#setupDefaultTokens (param $0 i32)
  (local $1 i32)
  (if
   (i32.eqz
    (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TokenMap>#exists
     (i32.load offset=28
      (local.get $0)
     )
     (i64.const 5197392)
    )
   )
   (block
    (call $~lib/as-chain/name/Name#set:N
     (local.tee $1
      (call $~lib/rt/stub/__new
       (i32.const 8)
       (i32.const 5)
      )
     )
     (i64.const 0)
    )
    (call $~lib/as-chain/name/Name#set:N
     (local.get $1)
     (i64.const 6138663591592764928)
    )
    (local.set $1
     (call $assembly/atomarb.contract/TokenMap#constructor
      (i64.const 5197392)
      (local.get $1)
      (i32.const 4)
     )
    )
    (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TokenMap>#store
     (i32.load offset=28
      (local.get $0)
     )
     (local.get $1)
     (i32.load
      (local.get $0)
     )
    )
   )
  )
  (if
   (i32.eqz
    (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TokenMap>#exists
     (i32.load offset=28
      (local.get $0)
     )
     (i64.const 1146312024)
    )
   )
   (block
    (call $~lib/as-chain/name/Name#set:N
     (local.tee $1
      (call $~lib/rt/stub/__new
       (i32.const 8)
       (i32.const 5)
      )
     )
     (i64.const 0)
    )
    (call $~lib/as-chain/name/Name#set:N
     (local.get $1)
     (i64.const -1267475983267528704)
    )
    (local.set $1
     (call $assembly/atomarb.contract/TokenMap#constructor
      (i64.const 1146312024)
      (local.get $1)
      (i32.const 6)
     )
    )
    (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TokenMap>#store
     (i32.load offset=28
      (local.get $0)
     )
     (local.get $1)
     (i32.load
      (local.get $0)
     )
    )
   )
  )
  (if
   (i32.eqz
    (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TokenMap>#exists
     (i32.load offset=28
      (local.get $0)
     )
     (i64.const 4476504)
    )
   )
   (block
    (call $~lib/as-chain/name/Name#set:N
     (local.tee $1
      (call $~lib/rt/stub/__new
       (i32.const 8)
       (i32.const 5)
      )
     )
     (i64.const 0)
    )
    (call $~lib/as-chain/name/Name#set:N
     (local.get $1)
     (i64.const -1400042437898403840)
    )
    (local.set $1
     (call $assembly/atomarb.contract/TokenMap#constructor
      (i64.const 4476504)
      (local.get $1)
      (i32.const 6)
     )
    )
    (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TokenMap>#store
     (i32.load offset=28
      (local.get $0)
     )
     (local.get $1)
     (i32.load
      (local.get $0)
     )
    )
   )
  )
  (if
   (i32.eqz
    (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TokenMap>#exists
     (i32.load offset=28
      (local.get $0)
     )
     (i64.const 5525592)
    )
   )
   (block
    (call $~lib/as-chain/name/Name#set:N
     (local.tee $1
      (call $~lib/rt/stub/__new
       (i32.const 8)
       (i32.const 5)
      )
     )
     (i64.const 0)
    )
    (call $~lib/as-chain/name/Name#set:N
     (local.get $1)
     (i64.const -1267475983267528704)
    )
    (local.set $1
     (call $assembly/atomarb.contract/TokenMap#constructor
      (i64.const 5525592)
      (local.get $1)
      (i32.const 8)
     )
    )
    (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TokenMap>#store
     (i32.load offset=28
      (local.get $0)
     )
     (local.get $1)
     (i32.load
      (local.get $0)
     )
    )
   )
  )
 )
 (func $~lib/as-chain/serializer/Decoder#unpackLength (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (loop $while-continue|0
   (local.set $1
    (i32.or
     (local.get $1)
     (i32.shl
      (i32.and
       (local.tee $3
        (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
         (local.get $0)
        )
       )
       (i32.const 127)
      )
      (local.get $2)
     )
    )
   )
   (local.set $2
    (i32.add
     (local.get $2)
     (i32.const 7)
    )
   )
   (local.set $4
    (i32.add
     (local.get $4)
     (i32.const 1)
    )
   )
   (br_if $while-continue|0
    (i32.and
     (local.get $3)
     (i32.const 128)
    )
   )
  )
  (local.get $1)
 )
 (func $~lib/rt/stub/__renew (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (if
   (i32.gt_u
    (local.get $1)
    (i32.const 1073741804)
   )
   (unreachable)
  )
  (local.set $3
   (i32.add
    (local.get $1)
    (i32.const 16)
   )
  )
  (if
   (i32.eqz
    (select
     (i32.eqz
      (i32.and
       (local.tee $0
        (i32.sub
         (local.get $0)
         (i32.const 16)
        )
       )
       (i32.const 15)
      )
     )
     (i32.const 0)
     (local.get $0)
    )
   )
   (unreachable)
  )
  (local.set $6
   (i32.eq
    (global.get $~lib/rt/stub/offset)
    (i32.add
     (local.get $0)
     (local.tee $4
      (i32.load
       (local.tee $5
        (i32.sub
         (local.get $0)
         (i32.const 4)
        )
       )
      )
     )
    )
   )
  )
  (local.set $2
   (i32.sub
    (i32.and
     (i32.add
      (local.get $3)
      (i32.const 19)
     )
     (i32.const -16)
    )
    (i32.const 4)
   )
  )
  (if
   (i32.gt_u
    (local.get $3)
    (local.get $4)
   )
   (if
    (local.get $6)
    (block
     (if
      (i32.gt_u
       (local.get $3)
       (i32.const 1073741820)
      )
      (unreachable)
     )
     (call $~lib/rt/stub/maybeGrowMemory
      (i32.add
       (local.get $0)
       (local.get $2)
      )
     )
     (call $~lib/rt/common/BLOCK#set:mmInfo
      (local.get $5)
      (local.get $2)
     )
    )
    (block
     (call $~lib/memory/memory.copy
      (local.tee $2
       (call $~lib/rt/stub/__alloc
        (select
         (local.get $2)
         (local.tee $3
          (i32.shl
           (local.get $4)
           (i32.const 1)
          )
         )
         (i32.gt_u
          (local.get $2)
          (local.get $3)
         )
        )
       )
      )
      (local.get $0)
      (local.get $4)
     )
     (local.set $0
      (local.get $2)
     )
    )
   )
   (if
    (local.get $6)
    (block
     (global.set $~lib/rt/stub/offset
      (i32.add
       (local.get $0)
       (local.get $2)
      )
     )
     (call $~lib/rt/common/BLOCK#set:mmInfo
      (local.get $5)
      (local.get $2)
     )
    )
   )
  )
  (call $~lib/rt/common/OBJECT#set:rtSize
   (i32.sub
    (local.get $0)
    (i32.const 4)
   )
   (local.get $1)
  )
  (i32.add
   (local.get $0)
   (i32.const 16)
  )
 )
 (func $~lib/string/String.UTF8.decodeUnsafe (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (if
   (i32.gt_u
    (local.get $0)
    (local.tee $3
     (i32.add
      (local.get $0)
      (local.get $1)
     )
    )
   )
   (unreachable)
  )
  (local.set $1
   (local.tee $5
    (call $~lib/rt/stub/__new
     (i32.shl
      (local.get $1)
      (i32.const 1)
     )
     (i32.const 1)
    )
   )
  )
  (loop $while-continue|0
   (if
    (i32.lt_u
     (local.get $0)
     (local.get $3)
    )
    (block $while-break|0
     (local.set $2
      (i32.load8_u
       (local.get $0)
      )
     )
     (local.set $0
      (i32.add
       (local.get $0)
       (i32.const 1)
      )
     )
     (if
      (i32.and
       (local.get $2)
       (i32.const 128)
      )
      (block
       (br_if $while-break|0
        (i32.eq
         (local.get $0)
         (local.get $3)
        )
       )
       (local.set $4
        (i32.and
         (i32.load8_u
          (local.get $0)
         )
         (i32.const 63)
        )
       )
       (local.set $0
        (i32.add
         (local.get $0)
         (i32.const 1)
        )
       )
       (if
        (i32.eq
         (i32.and
          (local.get $2)
          (i32.const 224)
         )
         (i32.const 192)
        )
        (i32.store16
         (local.get $1)
         (i32.or
          (local.get $4)
          (i32.shl
           (i32.and
            (local.get $2)
            (i32.const 31)
           )
           (i32.const 6)
          )
         )
        )
        (block
         (br_if $while-break|0
          (i32.eq
           (local.get $0)
           (local.get $3)
          )
         )
         (local.set $6
          (i32.and
           (i32.load8_u
            (local.get $0)
           )
           (i32.const 63)
          )
         )
         (local.set $0
          (i32.add
           (local.get $0)
           (i32.const 1)
          )
         )
         (if
          (i32.eq
           (i32.and
            (local.get $2)
            (i32.const 240)
           )
           (i32.const 224)
          )
          (local.set $2
           (i32.or
            (local.get $6)
            (i32.or
             (i32.shl
              (i32.and
               (local.get $2)
               (i32.const 15)
              )
              (i32.const 12)
             )
             (i32.shl
              (local.get $4)
              (i32.const 6)
             )
            )
           )
          )
          (block
           (br_if $while-break|0
            (i32.eq
             (local.get $0)
             (local.get $3)
            )
           )
           (local.set $2
            (i32.or
             (i32.and
              (i32.load8_u
               (local.get $0)
              )
              (i32.const 63)
             )
             (i32.or
              (i32.or
               (i32.shl
                (i32.and
                 (local.get $2)
                 (i32.const 7)
                )
                (i32.const 18)
               )
               (i32.shl
                (local.get $4)
                (i32.const 12)
               )
              )
              (i32.shl
               (local.get $6)
               (i32.const 6)
              )
             )
            )
           )
           (local.set $0
            (i32.add
             (local.get $0)
             (i32.const 1)
            )
           )
          )
         )
         (if
          (i32.lt_u
           (local.get $2)
           (i32.const 65536)
          )
          (i32.store16
           (local.get $1)
           (local.get $2)
          )
          (block
           (i32.store
            (local.get $1)
            (i32.or
             (i32.or
              (i32.shr_u
               (local.tee $2
                (i32.sub
                 (local.get $2)
                 (i32.const 65536)
                )
               )
               (i32.const 10)
              )
              (i32.const 55296)
             )
             (i32.shl
              (i32.or
               (i32.and
                (local.get $2)
                (i32.const 1023)
               )
               (i32.const 56320)
              )
              (i32.const 16)
             )
            )
           )
           (local.set $1
            (i32.add
             (local.get $1)
             (i32.const 2)
            )
           )
          )
         )
        )
       )
      )
      (i32.store16
       (local.get $1)
       (local.get $2)
      )
     )
     (local.set $1
      (i32.add
       (local.get $1)
       (i32.const 2)
      )
     )
     (br $while-continue|0)
    )
   )
  )
  (call $~lib/rt/stub/__renew
   (local.get $5)
   (i32.sub
    (local.get $1)
    (local.get $5)
   )
  )
 )
 (func $~lib/string/String.UTF8.decode (param $0 i32) (result i32)
  (call $~lib/string/String.UTF8.decodeUnsafe
   (local.get $0)
   (call $~lib/arraybuffer/ArrayBuffer#get:byteLength
    (local.get $0)
   )
  )
 )
 (func $~lib/as-chain/serializer/Decoder#unpackString (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#unpackLength
    (local.get $0)
   )
  )
  (local.set $2
   (call $~lib/array/Array<u8>#slice
    (i32.load
     (local.get $0)
    )
    (i32.load offset=4
     (local.get $0)
    )
    (i32.add
     (local.get $1)
     (i32.load offset=4
      (local.get $0)
     )
    )
   )
  )
  (call $~lib/as-chain/serializer/Decoder#incPos
   (local.get $0)
   (local.get $1)
  )
  (call $~lib/string/String.UTF8.decode
   (i32.load
    (local.get $2)
   )
  )
 )
 (func $assembly/atomarb.contract/addTokenAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.tee $1
     (call $~lib/as-chain/serializer/Decoder#constructor
      (local.get $1)
     )
    )
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $~lib/string/String#charCodeAt (param $0 i32) (param $1 i32) (result i32)
  (if
   (i32.le_u
    (call $~lib/string/String#get:length
     (local.get $0)
    )
    (local.get $1)
   )
   (return
    (i32.const -1)
   )
  )
  (i32.load16_u
   (i32.add
    (local.get $0)
    (i32.shl
     (local.get $1)
     (i32.const 1)
    )
   )
  )
 )
 (func $~lib/as-chain/asset/Symbol#constructor (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i64)
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 60)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/system/check
   (i32.le_s
    (call $~lib/string/String#get:length
     (local.get $0)
    )
    (i32.const 7)
   )
   (i32.const 3360)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (loop $for-loop|0
   (if
    (i32.gt_s
     (call $~lib/string/String#get:length
      (local.get $0)
     )
     (local.get $3)
    )
    (block
     (call $~lib/as-chain/system/check
      (select
       (i64.le_u
        (local.tee $4
         (i64.extend_i32_s
          (call $~lib/string/String#charCodeAt
           (local.get $0)
           (i32.sub
            (i32.sub
             (call $~lib/string/String#get:length
              (local.get $0)
             )
             (i32.const 1)
            )
            (local.get $3)
           )
          )
         )
        )
        (i64.const 90)
       )
       (i32.const 0)
       (i64.ge_u
        (local.get $4)
        (i64.const 65)
       )
      )
      (i32.const 3424)
     )
     (call $~lib/as-chain/name/Name#set:N
      (local.get $2)
      (i64.or
       (local.get $4)
       (i64.load
        (local.get $2)
       )
      )
     )
     (call $~lib/as-chain/name/Name#set:N
      (local.get $2)
      (i64.shl
       (i64.load
        (local.get $2)
       )
       (i64.const 8)
      )
     )
     (local.set $3
      (i32.add
       (local.get $3)
       (i32.const 1)
      )
     )
     (br $for-loop|0)
    )
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.or
    (i64.load
     (local.get $2)
    )
    (i64.extend_i32_u
     (i32.and
      (local.get $1)
      (i32.const 255)
     )
    )
   )
  )
  (local.get $2)
 )
 (func $~lib/as-chain/asset/Symbol#code (param $0 i32) (result i64)
  (i64.shr_u
   (i64.load
    (local.get $0)
   )
   (i64.const 8)
  )
 )
 (func $assembly/atomarb.contract/TokenMap#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.tee $1
     (call $~lib/as-chain/serializer/Decoder#constructor
      (local.get $1)
     )
    )
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $0)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/TradeRecord#set:route
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/TokenMap>#remove (param $0 i32) (param $1 i32)
  (call $~lib/as-chain/env/db_remove_i64
   (i32.load offset=4
    (local.get $1)
   )
  )
 )
 (func $~lib/as-chain/idxdb/SecondaryIterator#isOk (param $0 i32) (result i32)
  (i32.ge_s
   (i32.load
    (local.get $0)
   )
   (i32.const 0)
  )
 )
 (func $assembly/atomarb.contract/addAmmPoolAction#set:quote_precision (param $0 i32) (param $1 i32)
  (i32.store8 offset=16
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/addAmmPoolAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.tee $1
     (call $~lib/as-chain/serializer/Decoder#constructor
      (local.get $1)
     )
    )
   )
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.get $1)
   )
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (call $~lib/rt/common/OBJECT#set:rtId
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/addAmmPoolAction#set:quote_precision
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/Config#set:total_trades
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/AmmPool>#constructor (param $0 i32) (param $1 i32) (param $2 i64) (param $3 i32) (result i32)
  (local $4 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $4
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 62)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (i32.const 0)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (i64.const 0)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $4)
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (local.get $1)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (local.get $2)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (local.get $3)
  )
  (local.get $4)
 )
 (func $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/AmmPool>#end (param $0 i32) (result i32)
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/AmmPool>#constructor
   (local.tee $0
    (i32.load
     (local.get $0)
    )
   )
   (call $~lib/as-chain/env/db_end_i64
    (i64.load
     (local.get $0)
    )
    (i64.load offset=8
     (local.get $0)
    )
    (i64.load offset=16
     (local.get $0)
    )
   )
   (i64.const 0)
   (i32.const 0)
  )
 )
 (func $assembly/atomarb.contract/AmmPool#unpack (param $0 i32) (param $1 i32) (result i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.tee $1
     (call $~lib/as-chain/serializer/Decoder#constructor
      (local.get $1)
     )
    )
   )
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/Config#set:total_trades
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:base_symbol
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/AmmPool#set:enabled
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AmmPool>#get:availablePrimaryKey (param $0 i32) (result i64)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i64)
  (local $5 i64)
  (if
   (i64.eq
    (i64.load offset=8
     (local.get $0)
    )
    (i64.const -1)
   )
   (if
    (i32.eq
     (i32.load offset=4
      (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/AmmPool>#constructor
       (local.tee $1
        (i32.load
         (i32.load
          (local.get $0)
         )
        )
       )
       (call $~lib/as-chain/env/db_lowerbound_i64
        (i64.load
         (local.get $1)
        )
        (i64.load offset=8
         (local.get $1)
        )
        (i64.load offset=16
         (local.get $1)
        )
        (i64.const 0)
       )
       (i64.const 0)
       (i32.const 0)
      )
     )
     (i32.load offset=4
      (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/AmmPool>#end
       (i32.load
        (local.get $0)
       )
      )
     )
    )
    (call $assembly/atomarb.contract/ArbState#set:starting_balance
     (local.get $0)
     (i64.const 0)
    )
    (block
     (local.set $2
      (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/AmmPool>#end
       (i32.load
        (local.get $0)
       )
      )
     )
     (local.set $1
      (i32.load
       (i32.load
        (local.get $0)
       )
      )
     )
     (local.set $3
      (call $~lib/rt/stub/__alloc
       (i32.const 8)
      )
     )
     (local.set $2
      (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/AmmPool>#constructor
       (local.get $1)
       (call $~lib/as-chain/env/db_previous_i64
        (i32.load offset=4
         (local.get $2)
        )
        (local.get $3)
       )
       (i64.load
        (local.get $3)
       )
       (i32.const 1)
      )
     )
     (drop
      (i32.load
       (i32.load
        (local.get $0)
       )
      )
     )
     (block $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/AmmPool>#get
      (if
       (i32.eqz
        (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
         (local.get $2)
        )
       )
       (block
        (local.set $1
         (i32.const 0)
        )
        (br $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/AmmPool>#get)
       )
      )
      (local.set $1
       (i32.const 0)
      )
      (if
       (local.tee $3
        (call $~lib/as-chain/env/db_get_i64
         (local.tee $2
          (i32.load offset=4
           (local.get $2)
          )
         )
         (i32.const 0)
         (i32.const 0)
        )
       )
       (block
        (drop
         (call $~lib/as-chain/env/db_get_i64
          (local.get $2)
          (i32.load offset=4
           (local.tee $2
            (call $~lib/array/Array<u8>#constructor
             (local.get $3)
            )
           )
          )
          (local.get $3)
         )
        )
        (drop
         (call $assembly/atomarb.contract/AmmPool#unpack
          (local.tee $1
           (call $assembly/atomarb.contract/AmmPool#constructor
            (i64.const 0)
            (i32.const 2448)
            (i64.const 0)
            (i64.const 0)
            (i64.const 20)
           )
          )
          (local.get $2)
         )
        )
       )
      )
     )
     (local.set $5
      (local.tee $4
       (i64.load
        (if (result i32)
         (local.get $1)
         (local.get $1)
         (call $assembly/atomarb.contract/AmmPool#constructor
          (i64.const 0)
          (i32.const 2448)
          (i64.const 0)
          (i64.const 0)
          (i64.const 20)
         )
        )
       )
      )
     )
     (if
      (i64.ge_u
       (local.get $4)
       (i64.const -2)
      )
      (call $assembly/atomarb.contract/ArbState#set:starting_balance
       (local.get $0)
       (i64.const -2)
      )
      (call $assembly/atomarb.contract/ArbState#set:starting_balance
       (local.get $0)
       (i64.add
        (local.get $5)
        (i64.const 1)
       )
      )
     )
    )
   )
  )
  (call $~lib/as-chain/system/check
   (i64.lt_u
    (i64.load offset=8
     (local.get $0)
    )
    (i64.const -2)
   )
   (i32.const 2160)
  )
  (i64.load offset=8
   (local.get $0)
  )
 )
 (func $~lib/as-chain/varint/calcPackedVarUint32Length (param $0 i32) (result i32)
  (local $1 i32)
  (loop $while-continue|0
   (local.set $1
    (i32.add
     (local.get $1)
     (i32.const 1)
    )
   )
   (br_if $while-continue|0
    (local.tee $0
     (i32.shr_u
      (local.get $0)
      (i32.const 7)
     )
    )
   )
  )
  (local.get $1)
 )
 (func $~lib/as-chain/utils/Utils.calcPackedStringLength (param $0 i32) (result i32)
  (i32.add
   (call $~lib/as-chain/varint/calcPackedVarUint32Length
    (call $~lib/arraybuffer/ArrayBuffer#get:byteLength
     (local.tee $0
      (call $~lib/string/String.UTF8.encode
       (local.get $0)
       (i32.const 0)
      )
     )
    )
   )
   (call $~lib/arraybuffer/ArrayBuffer#get:byteLength
    (local.get $0)
   )
  )
 )
 (func $~lib/as-chain/serializer/Encoder#packLength (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (loop $while-continue|0
   (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
    (local.get $0)
    (select
     (i32.or
      (local.tee $2
       (i32.and
        (local.get $1)
        (i32.const 127)
       )
      )
      (i32.const 128)
     )
     (local.get $2)
     (local.tee $1
      (i32.shr_u
       (local.get $1)
       (i32.const 7)
      )
     )
    )
   )
   (local.set $3
    (i32.add
     (local.get $3)
     (i32.const 1)
    )
   )
   (br_if $while-continue|0
    (local.get $1)
   )
  )
 )
 (func $~lib/as-chain/serializer/Encoder#packString (param $0 i32) (param $1 i32)
  (local $2 i32)
  (call $~lib/as-chain/serializer/Encoder#packLength
   (local.get $0)
   (call $~lib/arraybuffer/ArrayBuffer#get:byteLength
    (local.tee $1
     (call $~lib/string/String.UTF8.encode
      (local.get $1)
      (i32.const 0)
     )
    )
   )
  )
  (local.set $2
   (i32.add
    (i32.load offset=4
     (i32.load
      (local.get $0)
     )
    )
    (i32.load offset=4
     (local.get $0)
    )
   )
  )
  (call $~lib/as-chain/serializer/Encoder#incPos
   (local.get $0)
   (call $~lib/arraybuffer/ArrayBuffer#get:byteLength
    (local.get $1)
   )
  )
  (drop
   (call $~lib/as-chain/env/memcpy
    (local.get $2)
    (local.get $1)
    (call $~lib/arraybuffer/ArrayBuffer#get:byteLength
     (local.get $1)
    )
   )
  )
  (drop
   (call $~lib/arraybuffer/ArrayBuffer#get:byteLength
    (local.get $1)
   )
  )
 )
 (func $assembly/atomarb.contract/AmmPool#pack (param $0 i32) (result i32)
  (local $1 i32)
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.tee $1
    (call $~lib/as-chain/serializer/Encoder#constructor
     (i32.add
      (call $~lib/as-chain/utils/Utils.calcPackedStringLength
       (i32.load offset=8
        (local.get $0)
       )
      )
      (i32.const 33)
     )
    )
   )
   (i64.load
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packString
   (local.get $1)
   (i32.load offset=8
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=16
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=24
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=32
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
   (local.get $1)
   (i32.load8_u offset=40
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#getBytes
   (local.get $1)
  )
 )
 (func $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AmmPool>#store (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i64)
  (local $5 i32)
  (local $6 i64)
  (local $7 i32)
  (local $8 i64)
  (local $9 i32)
  (local $10 i32)
  (local.set $4
   (local.tee $6
    (i64.load
     (local.get $1)
    )
   )
  )
  (call $~lib/as-chain/system/check
   (i32.eqz
    (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
     (block $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/AmmPool>#find (result i32)
      (if
       (i32.ge_s
        (local.tee $5
         (call $~lib/as-chain/env/db_find_i64
          (i64.load
           (local.tee $3
            (i32.load
             (i32.load
              (local.get $0)
             )
            )
           )
          )
          (i64.load offset=8
           (local.get $3)
          )
          (i64.load offset=16
           (local.get $3)
          )
          (local.get $6)
         )
        )
        (i32.const 0)
       )
       (br $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/AmmPool>#find
        (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/AmmPool>#constructor
         (local.get $3)
         (local.get $5)
         (local.get $4)
         (i32.const 1)
        )
       )
      )
      (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/AmmPool>#constructor
       (local.get $3)
       (local.get $5)
       (i64.const 0)
       (i32.const 0)
      )
     )
    )
   )
   (i32.const 1200)
  )
  (local.set $3
   (i32.const 0)
  )
  (local.set $4
   (i64.load
    (local.get $1)
   )
  )
  (local.set $8
   (i64.load
    (local.get $2)
   )
  )
  (local.set $7
   (i32.load
    (local.tee $5
     (i32.load
      (local.get $0)
     )
    )
   )
  )
  (local.set $10
   (i32.load offset=12
    (local.tee $9
     (call $assembly/atomarb.contract/AmmPool#pack
      (local.get $1)
     )
    )
   )
  )
  (drop
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/AmmPool>#constructor
    (local.get $7)
    (call $~lib/as-chain/env/db_store_i64
     (i64.load offset=8
      (local.get $7)
     )
     (i64.load offset=16
      (local.get $7)
     )
     (local.get $8)
     (local.get $4)
     (i32.load offset=4
      (local.get $9)
     )
     (local.get $10)
    )
    (local.get $4)
    (i32.const 1)
   )
  )
  (loop $for-loop|0
   (if
    (i32.lt_s
     (local.get $3)
     (i32.load offset=12
      (i32.load offset=4
       (local.get $5)
      )
     )
    )
    (block
     (call $~lib/as-chain/idxdb/IDXDB#storeEx@virtual
      (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
       (i32.load offset=4
        (local.get $5)
       )
       (local.get $3)
      )
      (i64.load
       (local.get $1)
      )
      (call $assembly/atomarb.contract/Config#getSecondaryValue)
      (i64.load
       (local.get $2)
      )
     )
     (local.set $3
      (i32.add
       (local.get $3)
       (i32.const 1)
      )
     )
     (br $for-loop|0)
    )
   )
  )
  (if
   (i64.ge_u
    (local.tee $4
     (i64.load
      (local.get $1)
     )
    )
    (i64.load offset=8
     (local.get $5)
    )
   )
   (call $assembly/atomarb.contract/ArbState#set:starting_balance
    (local.get $5)
    (select
     (i64.const -2)
     (i64.add
      (local.get $4)
      (i64.const 1)
     )
     (i64.ge_u
      (local.get $4)
      (i64.const -2)
     )
    )
   )
  )
  (if
   (i64.ge_u
    (local.get $6)
    (i64.load offset=8
     (local.get $0)
    )
   )
   (call $assembly/atomarb.contract/ArbState#set:starting_balance
    (local.get $0)
    (select
     (i64.const -2)
     (i64.add
      (local.get $6)
      (i64.const 1)
     )
     (i64.ge_u
      (local.get $6)
      (i64.const -2)
     )
    )
   )
  )
 )
 (func $assembly/atomarb.contract/addDexMarketAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.tee $1
     (call $~lib/as-chain/serializer/Decoder#constructor
      (local.get $1)
     )
    )
   )
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.get $1)
   )
  )
  (call $~lib/rt/common/OBJECT#set:rtId
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/addAmmPoolAction#set:quote_precision
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/AtomArb#set:authorizedTable
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:route
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:base_symbol
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:quote_symbol
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/DexMarket>#constructor (param $0 i32) (param $1 i32) (param $2 i64) (param $3 i32) (result i32)
  (local $4 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $4
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 64)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (i32.const 0)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (i64.const 0)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $4)
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (local.get $1)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (local.get $2)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (local.get $3)
  )
  (local.get $4)
 )
 (func $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/DexMarket>#end (param $0 i32) (result i32)
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/DexMarket>#constructor
   (local.tee $0
    (i32.load
     (local.get $0)
    )
   )
   (call $~lib/as-chain/env/db_end_i64
    (i64.load
     (local.get $0)
    )
    (i64.load offset=8
     (local.get $0)
    )
    (i64.load offset=16
     (local.get $0)
    )
   )
   (i64.const 0)
   (i32.const 0)
  )
 )
 (func $assembly/atomarb.contract/DexMarket#unpack (param $0 i32) (param $1 i32) (result i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.tee $1
     (call $~lib/as-chain/serializer/Decoder#constructor
      (local.get $1)
     )
    )
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $~lib/rt/common/OBJECT#set:rtSize
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/Config#set:total_trades
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:base_symbol
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:quote_symbol
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:intermediate_symbol
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/DexMarket#set:enabled
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/DexMarket>#get:availablePrimaryKey (param $0 i32) (result i64)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i64)
  (local $5 i64)
  (if
   (i64.eq
    (i64.load offset=8
     (local.get $0)
    )
    (i64.const -1)
   )
   (if
    (i32.eq
     (i32.load offset=4
      (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/DexMarket>#constructor
       (local.tee $1
        (i32.load
         (i32.load
          (local.get $0)
         )
        )
       )
       (call $~lib/as-chain/env/db_lowerbound_i64
        (i64.load
         (local.get $1)
        )
        (i64.load offset=8
         (local.get $1)
        )
        (i64.load offset=16
         (local.get $1)
        )
        (i64.const 0)
       )
       (i64.const 0)
       (i32.const 0)
      )
     )
     (i32.load offset=4
      (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/DexMarket>#end
       (i32.load
        (local.get $0)
       )
      )
     )
    )
    (call $assembly/atomarb.contract/ArbState#set:starting_balance
     (local.get $0)
     (i64.const 0)
    )
    (block
     (local.set $2
      (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/DexMarket>#end
       (i32.load
        (local.get $0)
       )
      )
     )
     (local.set $1
      (i32.load
       (i32.load
        (local.get $0)
       )
      )
     )
     (local.set $3
      (call $~lib/rt/stub/__alloc
       (i32.const 8)
      )
     )
     (local.set $2
      (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/DexMarket>#constructor
       (local.get $1)
       (call $~lib/as-chain/env/db_previous_i64
        (i32.load offset=4
         (local.get $2)
        )
        (local.get $3)
       )
       (i64.load
        (local.get $3)
       )
       (i32.const 1)
      )
     )
     (drop
      (i32.load
       (i32.load
        (local.get $0)
       )
      )
     )
     (block $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/DexMarket>#get
      (if
       (i32.eqz
        (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
         (local.get $2)
        )
       )
       (block
        (local.set $1
         (i32.const 0)
        )
        (br $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/DexMarket>#get)
       )
      )
      (local.set $1
       (i32.const 0)
      )
      (if
       (local.tee $3
        (call $~lib/as-chain/env/db_get_i64
         (local.tee $2
          (i32.load offset=4
           (local.get $2)
          )
         )
         (i32.const 0)
         (i32.const 0)
        )
       )
       (block
        (drop
         (call $~lib/as-chain/env/db_get_i64
          (local.get $2)
          (i32.load offset=4
           (local.tee $2
            (call $~lib/array/Array<u8>#constructor
             (local.get $3)
            )
           )
          )
          (local.get $3)
         )
        )
        (drop
         (call $assembly/atomarb.contract/DexMarket#unpack
          (local.tee $1
           (call $assembly/atomarb.contract/DexMarket#constructor
            (i64.const 0)
            (i64.const 0)
            (i32.const 2448)
            (i64.const 0)
            (i64.const 0)
            (i64.const 10)
            (i64.const 10)
           )
          )
          (local.get $2)
         )
        )
       )
      )
     )
     (local.set $5
      (local.tee $4
       (i64.load
        (if (result i32)
         (local.get $1)
         (local.get $1)
         (call $assembly/atomarb.contract/DexMarket#constructor
          (i64.const 0)
          (i64.const 0)
          (i32.const 2448)
          (i64.const 0)
          (i64.const 0)
          (i64.const 10)
          (i64.const 10)
         )
        )
       )
      )
     )
     (if
      (i64.ge_u
       (local.get $4)
       (i64.const -2)
      )
      (call $assembly/atomarb.contract/ArbState#set:starting_balance
       (local.get $0)
       (i64.const -2)
      )
      (call $assembly/atomarb.contract/ArbState#set:starting_balance
       (local.get $0)
       (i64.add
        (local.get $5)
        (i64.const 1)
       )
      )
     )
    )
   )
  )
  (call $~lib/as-chain/system/check
   (i64.lt_u
    (i64.load offset=8
     (local.get $0)
    )
    (i64.const -2)
   )
   (i32.const 2160)
  )
  (i64.load offset=8
   (local.get $0)
  )
 )
 (func $assembly/atomarb.contract/DexMarket#pack (param $0 i32) (result i32)
  (local $1 i32)
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.tee $1
    (call $~lib/as-chain/serializer/Encoder#constructor
     (i32.add
      (call $~lib/as-chain/utils/Utils.calcPackedStringLength
       (i32.load offset=16
        (local.get $0)
       )
      )
      (i32.const 49)
     )
    )
   )
   (i64.load
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=8
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packString
   (local.get $1)
   (i32.load offset=16
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=24
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=32
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=40
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=48
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
   (local.get $1)
   (i32.load8_u offset=56
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#getBytes
   (local.get $1)
  )
 )
 (func $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/DexMarket>#store (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i64)
  (local $5 i32)
  (local $6 i64)
  (local $7 i32)
  (local $8 i64)
  (local $9 i32)
  (local $10 i32)
  (local.set $4
   (local.tee $6
    (i64.load
     (local.get $1)
    )
   )
  )
  (call $~lib/as-chain/system/check
   (i32.eqz
    (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
     (block $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/DexMarket>#find (result i32)
      (if
       (i32.ge_s
        (local.tee $5
         (call $~lib/as-chain/env/db_find_i64
          (i64.load
           (local.tee $3
            (i32.load
             (i32.load
              (local.get $0)
             )
            )
           )
          )
          (i64.load offset=8
           (local.get $3)
          )
          (i64.load offset=16
           (local.get $3)
          )
          (local.get $6)
         )
        )
        (i32.const 0)
       )
       (br $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/DexMarket>#find
        (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/DexMarket>#constructor
         (local.get $3)
         (local.get $5)
         (local.get $4)
         (i32.const 1)
        )
       )
      )
      (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/DexMarket>#constructor
       (local.get $3)
       (local.get $5)
       (i64.const 0)
       (i32.const 0)
      )
     )
    )
   )
   (i32.const 1200)
  )
  (local.set $3
   (i32.const 0)
  )
  (local.set $4
   (i64.load
    (local.get $1)
   )
  )
  (local.set $8
   (i64.load
    (local.get $2)
   )
  )
  (local.set $7
   (i32.load
    (local.tee $5
     (i32.load
      (local.get $0)
     )
    )
   )
  )
  (local.set $10
   (i32.load offset=12
    (local.tee $9
     (call $assembly/atomarb.contract/DexMarket#pack
      (local.get $1)
     )
    )
   )
  )
  (drop
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/DexMarket>#constructor
    (local.get $7)
    (call $~lib/as-chain/env/db_store_i64
     (i64.load offset=8
      (local.get $7)
     )
     (i64.load offset=16
      (local.get $7)
     )
     (local.get $8)
     (local.get $4)
     (i32.load offset=4
      (local.get $9)
     )
     (local.get $10)
    )
    (local.get $4)
    (i32.const 1)
   )
  )
  (loop $for-loop|0
   (if
    (i32.lt_s
     (local.get $3)
     (i32.load offset=12
      (i32.load offset=4
       (local.get $5)
      )
     )
    )
    (block
     (call $~lib/as-chain/idxdb/IDXDB#storeEx@virtual
      (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
       (i32.load offset=4
        (local.get $5)
       )
       (local.get $3)
      )
      (i64.load
       (local.get $1)
      )
      (call $assembly/atomarb.contract/Config#getSecondaryValue)
      (i64.load
       (local.get $2)
      )
     )
     (local.set $3
      (i32.add
       (local.get $3)
       (i32.const 1)
      )
     )
     (br $for-loop|0)
    )
   )
  )
  (if
   (i64.ge_u
    (local.tee $4
     (i64.load
      (local.get $1)
     )
    )
    (i64.load offset=8
     (local.get $5)
    )
   )
   (call $assembly/atomarb.contract/ArbState#set:starting_balance
    (local.get $5)
    (select
     (i64.const -2)
     (i64.add
      (local.get $4)
      (i64.const 1)
     )
     (i64.ge_u
      (local.get $4)
      (i64.const -2)
     )
    )
   )
  )
  (if
   (i64.ge_u
    (local.get $6)
    (i64.load offset=8
     (local.get $0)
    )
   )
   (call $assembly/atomarb.contract/ArbState#set:starting_balance
    (local.get $0)
    (select
     (i64.const -2)
     (i64.add
      (local.get $6)
      (i64.const 1)
     )
     (i64.ge_u
      (local.get $6)
      (i64.const -2)
     )
    )
   )
  )
 )
 (func $assembly/atomarb.contract/setConfigAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.tee $1
     (call $~lib/as-chain/serializer/Decoder#constructor
      (local.get $1)
     )
    )
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/addAmmPoolAction#set:quote_precision
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AuthorizedUser>#exists (param $0 i32) (param $1 i64) (result i32)
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
   (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/AuthorizedUser>#find
    (i32.load
     (local.get $0)
    )
    (local.get $1)
   )
  )
 )
 (func $assembly/atomarb.contract/AuthorizedUser#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $~lib/as-chain/asset/Asset#constructor@varargs (result i32)
  (local $0 i32)
  (local $1 i32)
  (block $2of2
   (block $1of2
    (block $outOfRange
     (br_table $1of2 $1of2 $2of2 $outOfRange
      (global.get $~argumentsLength)
     )
    )
    (unreachable)
   )
   (local.set $0
    (call $~lib/as-chain/asset/Symbol#constructor
     (i32.const 2448)
     (i32.const 0)
    )
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 12)
     (i32.const 69)
    )
   )
   (i64.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $1)
   (local.get $0)
  )
  (local.get $1)
 )
 (func $assembly/atomarb.contract/saveBalanceAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/TradeRecord#set:route
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.tee $2
    (call $~lib/as-chain/asset/Asset#constructor@varargs)
   )
  )
  (call $~lib/rt/common/OBJECT#set:rtSize
   (local.get $0)
   (local.get $2)
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/ArbState>#constructor (param $0 i32) (param $1 i32) (param $2 i64) (param $3 i32) (result i32)
  (local $4 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $4
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 70)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (i32.const 0)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (i64.const 0)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $4)
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (local.get $1)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (local.get $2)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (local.get $3)
  )
  (local.get $4)
 )
 (func $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/ArbState>#find (param $0 i32) (param $1 i64) (result i32)
  (local $2 i32)
  (block $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/ArbState>#find (result i32)
   (if
    (i32.ge_s
     (local.tee $2
      (call $~lib/as-chain/env/db_find_i64
       (i64.load
        (local.tee $0
         (i32.load
          (local.get $0)
         )
        )
       )
       (i64.load offset=8
        (local.get $0)
       )
       (i64.load offset=16
        (local.get $0)
       )
       (local.get $1)
      )
     )
     (i32.const 0)
    )
    (br $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/ArbState>#find
     (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/ArbState>#constructor
      (local.get $0)
      (local.get $2)
      (local.get $1)
      (i32.const 1)
     )
    )
   )
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/ArbState>#constructor
    (local.get $0)
    (local.get $2)
    (i64.const 0)
    (i32.const 0)
   )
  )
 )
 (func $assembly/atomarb.contract/ArbState#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:route
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:base_symbol
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:quote_symbol
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:intermediate_symbol
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:started_at
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/ArbState>#get (param $0 i32) (param $1 i32) (result i32)
  (if
   (i32.eqz
    (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
     (local.get $1)
    )
   )
   (return
    (i32.const 0)
   )
  )
  (block $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/ArbState>#getEx (result i32)
   (drop
    (br_if $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/ArbState>#getEx
     (i32.const 0)
     (i32.eqz
      (local.tee $1
       (call $~lib/as-chain/env/db_get_i64
        (local.tee $0
         (i32.load offset=4
          (local.get $1)
         )
        )
        (i32.const 0)
        (i32.const 0)
       )
      )
     )
    )
   )
   (drop
    (call $~lib/as-chain/env/db_get_i64
     (local.get $0)
     (i32.load offset=4
      (local.tee $0
       (call $~lib/array/Array<u8>#constructor
        (local.get $1)
       )
      )
     )
     (local.get $1)
    )
   )
   (global.set $~argumentsLength
    (i32.const 0)
   )
   (drop
    (call $assembly/atomarb.contract/ArbState#unpack
     (local.tee $1
      (call $assembly/atomarb.contract/ArbState#constructor@varargs)
     )
     (local.get $0)
    )
   )
   (local.get $1)
  )
 )
 (func $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#get (param $0 i32) (param $1 i64) (result i32)
  (local $2 i32)
  (block $__inlined_func$~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/ArbState>#getByKey (result i32)
   (drop
    (br_if $__inlined_func$~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/ArbState>#getByKey
     (i32.const 0)
     (i32.eqz
      (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
       (local.tee $2
        (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/ArbState>#find
         (local.tee $0
          (i32.load
           (local.get $0)
          )
         )
         (local.get $1)
        )
       )
      )
     )
    )
   )
   (call $~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/ArbState>#get
    (i32.load
     (local.get $0)
    )
    (local.get $2)
   )
  )
 )
 (func $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#remove (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i64)
  (local $4 i32)
  (local.set $3
   (call $assembly/atomarb.contract/AuthorizedUser#getPrimaryValue
    (local.get $1)
   )
  )
  (call $~lib/as-chain/system/check
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
    (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/ArbState>#find
     (i32.load
      (local.get $0)
     )
     (local.get $3)
    )
   )
   (i32.const 1648)
  )
  (local.set $1
   (i32.const 0)
  )
  (call $~lib/as-chain/system/check
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
    (local.tee $4
     (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/ArbState>#find
      (local.tee $2
       (i32.load
        (local.get $0)
       )
      )
      (local.get $3)
     )
    )
   )
   (i32.const 3488)
  )
  (call $~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/TokenMap>#remove
   (i32.load
    (local.get $2)
   )
   (local.get $4)
  )
  (loop $for-loop|0
   (if
    (i32.lt_s
     (local.get $1)
     (i32.load offset=12
      (i32.load offset=4
       (local.get $2)
      )
     )
    )
    (block
     (if
      (call $~lib/as-chain/idxdb/SecondaryIterator#isOk
       (i32.load
        (local.tee $4
         (call $~lib/as-chain/idxdb/IDXDB#findPrimaryEx@virtual
          (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
           (i32.load offset=4
            (local.get $2)
           )
           (local.get $1)
          )
         )
        )
       )
      )
      (call $~lib/as-chain/idxdb/IDXDB#remove@virtual
       (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
        (i32.load offset=4
         (local.get $2)
        )
        (local.get $1)
       )
       (i32.load
        (local.get $4)
       )
      )
     )
     (local.set $1
      (i32.add
       (local.get $1)
       (i32.const 1)
      )
     )
     (br $for-loop|0)
    )
   )
  )
  (if
   (i64.eq
    (local.get $3)
    (i64.sub
     (i64.load offset=8
      (local.get $0)
     )
     (i64.const 1)
    )
   )
   (call $assembly/atomarb.contract/ArbState#set:starting_balance
    (local.get $0)
    (i64.const -1)
   )
  )
 )
 (func $assembly/atomarb.contract/ExtTokenAccount#constructor@varargs (result i32)
  (local $0 i32)
  (local $1 i32)
  (block $1of1
   (block $0of1
    (block $outOfRange
     (br_table $0of1 $1of1 $outOfRange
      (global.get $~argumentsLength)
     )
    )
    (unreachable)
   )
   (global.set $~argumentsLength
    (i32.const 0)
   )
   (local.set $0
    (call $~lib/as-chain/asset/Asset#constructor@varargs)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 4)
     (i32.const 71)
    )
   )
   (local.get $0)
  )
  (local.get $1)
 )
 (func $assembly/atomarb.contract/ExtTokenAccount.get:tableName (result i32)
  (local $0 i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const 3607749779137757184)
  )
  (local.get $0)
 )
 (func $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/ExtTokenAccount>#constructor (param $0 i32) (param $1 i32) (param $2 i64) (param $3 i32) (result i32)
  (local $4 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $4
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 75)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (i32.const 0)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (i64.const 0)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $4)
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (local.get $1)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (local.get $2)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (local.get $3)
  )
  (local.get $4)
 )
 (func $assembly/atomarb.contract/ExtTokenAccount#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.tee $2
    (call $~lib/as-chain/asset/Asset#constructor@varargs)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/getBalance (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i64)
  (local $6 i32)
  (local $7 i32)
  (local $8 i64)
  (local $9 i64)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $4
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 72)
    )
   )
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $4)
   (i64.const -1)
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (drop
   (call $assembly/atomarb.contract/ExtTokenAccount#constructor@varargs)
  )
  (local.set $6
   (call $assembly/atomarb.contract/ExtTokenAccount.get:tableName)
  )
  (drop
   (i64.load
    (call $assembly/atomarb.contract/ExtTokenAccount.get:tableName)
   )
  )
  (local.set $7
   (call $~lib/rt/__newArray
    (i32.const 0)
    (i32.const 2)
    (i32.const 16)
    (i32.const 3760)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $3
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 73)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $3)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $3)
   (i64.const -1)
  )
  (local.set $5
   (i64.load
    (local.get $0)
   )
  )
  (local.set $8
   (i64.load
    (local.get $1)
   )
  )
  (local.set $9
   (i64.load
    (local.get $6)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 74)
    )
   )
   (local.get $5)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (local.get $8)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $0)
   (local.get $9)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $3)
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $3)
   (local.get $7)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $4)
   (local.get $3)
  )
  (local.set $5
   (call $~lib/as-chain/asset/Symbol#code
    (local.get $2)
   )
  )
  (call $~lib/as-chain/system/check
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
    (local.tee $1
     (block $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/ExtTokenAccount>#find (result i32)
      (if
       (i32.ge_s
        (local.tee $1
         (call $~lib/as-chain/env/db_find_i64
          (i64.load
           (local.tee $0
            (i32.load
             (i32.load
              (local.get $4)
             )
            )
           )
          )
          (i64.load offset=8
           (local.get $0)
          )
          (i64.load offset=16
           (local.get $0)
          )
          (local.get $5)
         )
        )
        (i32.const 0)
       )
       (br $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/ExtTokenAccount>#find
        (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/ExtTokenAccount>#constructor
         (local.get $0)
         (local.get $1)
         (local.get $5)
         (i32.const 1)
        )
       )
      )
      (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/ExtTokenAccount>#constructor
       (local.get $0)
       (local.get $1)
       (i64.const 0)
       (i32.const 0)
      )
     )
    )
   )
   (i32.const 3792)
  )
  (drop
   (i32.load
    (i32.load
     (local.get $4)
    )
   )
  )
  (block $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/ExtTokenAccount>#get
   (if
    (i32.eqz
     (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
      (local.get $1)
     )
    )
    (block
     (local.set $0
      (i32.const 0)
     )
     (br $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/ExtTokenAccount>#get)
    )
   )
   (local.set $0
    (i32.const 0)
   )
   (if
    (local.tee $1
     (call $~lib/as-chain/env/db_get_i64
      (local.tee $2
       (i32.load offset=4
        (local.get $1)
       )
      )
      (i32.const 0)
      (i32.const 0)
     )
    )
    (block
     (drop
      (call $~lib/as-chain/env/db_get_i64
       (local.get $2)
       (i32.load offset=4
        (local.tee $2
         (call $~lib/array/Array<u8>#constructor
          (local.get $1)
         )
        )
       )
       (local.get $1)
      )
     )
     (global.set $~argumentsLength
      (i32.const 0)
     )
     (drop
      (call $assembly/atomarb.contract/ExtTokenAccount#unpack
       (local.tee $0
        (call $assembly/atomarb.contract/ExtTokenAccount#constructor@varargs)
       )
       (local.get $2)
      )
     )
    )
   )
  )
  (i32.load
   (if (result i32)
    (local.get $0)
    (local.get $0)
    (block (result i32)
     (global.set $~argumentsLength
      (i32.const 0)
     )
     (call $assembly/atomarb.contract/ExtTokenAccount#constructor@varargs)
    )
   )
  )
 )
 (func $assembly/atomarb.contract/ArbState#pack (param $0 i32) (result i32)
  (local $1 i32)
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.tee $1
    (call $~lib/as-chain/serializer/Encoder#constructor
     (block (result i32)
      (drop
       (i32.load
        (local.get $0)
       )
      )
      (i32.const 57)
     )
    )
   )
   (i32.load
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=8
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=16
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
   (local.get $1)
   (i32.load8_u offset=24
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=32
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=40
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=48
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=56
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#getBytes
   (local.get $1)
  )
 )
 (func $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#store (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i64)
  (local $4 i64)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i64)
  (local $9 i32)
  (local $10 i32)
  (local.set $4
   (call $assembly/atomarb.contract/AuthorizedUser#getPrimaryValue
    (local.get $1)
   )
  )
  (call $~lib/as-chain/system/check
   (i32.eqz
    (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
     (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/ArbState>#find
      (i32.load
       (local.get $0)
      )
      (local.get $4)
     )
    )
   )
   (i32.const 1200)
  )
  (local.set $7
   (i32.load
    (local.tee $6
     (i32.load
      (local.get $0)
     )
    )
   )
  )
  (local.set $3
   (call $assembly/atomarb.contract/AuthorizedUser#getPrimaryValue
    (local.get $1)
   )
  )
  (local.set $8
   (i64.load
    (local.get $2)
   )
  )
  (local.set $10
   (i32.load offset=12
    (local.tee $9
     (call $assembly/atomarb.contract/ArbState#pack
      (local.get $1)
     )
    )
   )
  )
  (drop
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/ArbState>#constructor
    (local.get $7)
    (call $~lib/as-chain/env/db_store_i64
     (i64.load offset=8
      (local.get $7)
     )
     (i64.load offset=16
      (local.get $7)
     )
     (local.get $8)
     (local.get $3)
     (i32.load offset=4
      (local.get $9)
     )
     (local.get $10)
    )
    (local.get $3)
    (i32.const 1)
   )
  )
  (loop $for-loop|0
   (if
    (i32.lt_s
     (local.get $5)
     (i32.load offset=12
      (i32.load offset=4
       (local.get $6)
      )
     )
    )
    (block
     (call $~lib/as-chain/idxdb/IDXDB#storeEx@virtual
      (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
       (i32.load offset=4
        (local.get $6)
       )
       (local.get $5)
      )
      (call $assembly/atomarb.contract/AuthorizedUser#getPrimaryValue
       (local.get $1)
      )
      (call $assembly/atomarb.contract/Config#getSecondaryValue)
      (i64.load
       (local.get $2)
      )
     )
     (local.set $5
      (i32.add
       (local.get $5)
       (i32.const 1)
      )
     )
     (br $for-loop|0)
    )
   )
  )
  (if
   (i64.ge_u
    (local.tee $3
     (call $assembly/atomarb.contract/AuthorizedUser#getPrimaryValue
      (local.get $1)
     )
    )
    (i64.load offset=8
     (local.get $6)
    )
   )
   (call $assembly/atomarb.contract/ArbState#set:starting_balance
    (local.get $6)
    (select
     (i64.const -2)
     (i64.add
      (local.get $3)
      (i64.const 1)
     )
     (i64.ge_u
      (local.get $3)
      (i64.const -2)
     )
    )
   )
  )
  (if
   (i64.ge_u
    (local.get $4)
    (i64.load offset=8
     (local.get $0)
    )
   )
   (call $assembly/atomarb.contract/ArbState#set:starting_balance
    (local.get $0)
    (select
     (i64.const -2)
     (i64.add
      (local.get $4)
      (i64.const 1)
     )
     (i64.ge_u
      (local.get $4)
      (i64.const -2)
     )
    )
   )
  )
 )
 (func $assembly/atomarb.contract/arbLegOneAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:rtId
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.get $1)
   )
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.tee $2
    (call $~lib/as-chain/asset/Asset#constructor@varargs)
   )
  )
  (call $~lib/rt/common/OBJECT#set:rtSize
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/AtomArb#set:authorizedTable
   (local.get $0)
   (local.get $2)
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $~lib/string/String.__concat (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (block $__inlined_func$~lib/string/String#concat
   (if
    (i32.eqz
     (local.tee $2
      (i32.add
       (local.tee $3
        (i32.shl
         (call $~lib/string/String#get:length
          (local.get $0)
         )
         (i32.const 1)
        )
       )
       (local.tee $4
        (i32.shl
         (call $~lib/string/String#get:length
          (local.get $1)
         )
         (i32.const 1)
        )
       )
      )
     )
    )
    (block
     (local.set $2
      (i32.const 2448)
     )
     (br $__inlined_func$~lib/string/String#concat)
    )
   )
   (call $~lib/memory/memory.copy
    (local.tee $2
     (call $~lib/rt/stub/__new
      (local.get $2)
      (i32.const 1)
     )
    )
    (local.get $0)
    (local.get $3)
   )
   (call $~lib/memory/memory.copy
    (i32.add
     (local.get $2)
     (local.get $3)
    )
    (local.get $1)
    (local.get $4)
   )
  )
  (local.get $2)
 )
 (func $~lib/staticarray/StaticArray<~lib/string/String>#join (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (block $__inlined_func$~lib/util/string/joinReferenceArray<~lib/string/String> (result i32)
   (drop
    (br_if $__inlined_func$~lib/util/string/joinReferenceArray<~lib/string/String>
     (i32.const 2448)
     (i32.lt_s
      (local.tee $3
       (i32.sub
        (i32.shr_u
         (i32.load offset=16
          (i32.sub
           (local.tee $1
            (local.get $0)
           )
           (i32.const 20)
          )
         )
         (i32.const 2)
        )
        (i32.const 1)
       )
      )
      (i32.const 0)
     )
    )
   )
   (if
    (i32.eqz
     (local.get $3)
    )
    (br $__inlined_func$~lib/util/string/joinReferenceArray<~lib/string/String>
     (if (result i32)
      (local.tee $0
       (i32.load
        (local.get $1)
       )
      )
      (local.get $0)
      (i32.const 2448)
     )
    )
   )
   (local.set $0
    (i32.const 2448)
   )
   (local.set $4
    (call $~lib/string/String#get:length
     (i32.const 2448)
    )
   )
   (loop $for-loop|0
    (if
     (i32.lt_s
      (local.get $2)
      (local.get $3)
     )
     (block
      (if
       (local.tee $5
        (i32.load
         (i32.add
          (local.get $1)
          (i32.shl
           (local.get $2)
           (i32.const 2)
          )
         )
        )
       )
       (local.set $0
        (call $~lib/string/String.__concat
         (local.get $0)
         (local.get $5)
        )
       )
      )
      (if
       (local.get $4)
       (local.set $0
        (call $~lib/string/String.__concat
         (local.get $0)
         (i32.const 2448)
        )
       )
      )
      (local.set $2
       (i32.add
        (local.get $2)
        (i32.const 1)
       )
      )
      (br $for-loop|0)
     )
    )
   )
   (if (result i32)
    (local.tee $1
     (i32.load
      (i32.add
       (local.get $1)
       (i32.shl
        (local.get $3)
        (i32.const 2)
       )
      )
     )
    )
    (call $~lib/string/String.__concat
     (local.get $0)
     (local.get $1)
    )
    (local.get $0)
   )
  )
 )
 (func $~lib/as-chain/name/S2N (param $0 i32) (result i64)
  (local $1 i32)
  (local $2 i32)
  (local $3 i64)
  (local $4 i64)
  (local.set $2
   (i32.le_s
    (call $~lib/string/String#get:length
     (local.get $0)
    )
    (i32.const 13)
   )
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (i32.const 3920)
   (local.get $0)
  )
  (call $~lib/as-chain/system/check
   (local.get $2)
   (call $~lib/staticarray/StaticArray<~lib/string/String>#join
    (i32.const 3920)
   )
  )
  (loop $for-loop|0
   (if
    (i32.le_s
     (local.get $1)
     (i32.const 12)
    )
    (block
     (local.set $3
      (i64.const 0)
     )
     (if
      (select
       (i32.le_s
        (local.get $1)
        (i32.const 12)
       )
       (i32.const 0)
       (i32.gt_s
        (call $~lib/string/String#get:length
         (local.get $0)
        )
        (local.get $1)
       )
      )
      (block
       (local.set $2
        (call $~lib/string/String#charCodeAt
         (local.get $0)
         (local.get $1)
        )
       )
       (global.set $~argumentsLength
        (i32.const 1)
       )
       (if
        (i64.eq
         (local.tee $3
          (i64.extend_i32_u
           (i32.and
            (call_indirect (type $i32_=>_i32)
             (local.get $2)
             (i32.load
              (i32.const 1056)
             )
            )
            (i32.const 65535)
           )
          )
         )
         (i64.const 65535)
        )
        (block
         (call $~lib/rt/common/OBJECT#set:gcInfo
          (i32.const 4000)
          (local.get $0)
         )
         (call $~lib/as-chain/system/check
          (i32.const 0)
          (call $~lib/staticarray/StaticArray<~lib/string/String>#join
           (i32.const 4000)
          )
         )
         (return
          (i64.const 0)
         )
        )
       )
      )
     )
     (local.set $4
      (i64.or
       (local.get $4)
       (select
        (i64.shl
         (i64.and
          (local.get $3)
          (i64.const 31)
         )
         (i64.sub
          (i64.const 64)
          (i64.mul
           (i64.extend_i32_s
            (local.tee $2
             (i32.add
              (local.get $1)
              (i32.const 1)
             )
            )
           )
           (i64.const 5)
          )
         )
        )
        (i64.and
         (local.get $3)
         (i64.const 15)
        )
        (i32.lt_s
         (local.get $1)
         (i32.const 12)
        )
       )
      )
     )
     (local.set $1
      (local.get $2)
     )
     (br $for-loop|0)
    )
   )
  )
  (local.get $4)
 )
 (func $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#constructor (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i64)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 4)
     (i32.const 78)
    )
   )
   (i32.const 0)
  )
  (local.set $2
   (call $~lib/as-chain/name/S2N
    (i32.const 4032)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $1
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $1)
  )
  (local.get $0)
 )
 (func $~lib/as-chain/action/PermissionLevel#constructor (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 79)
    )
   )
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $2)
   (local.get $1)
  )
  (local.get $2)
 )
 (func $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#act (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (local $3 i32)
  (local.set $3
   (i32.load
    (local.get $0)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 12)
     (i32.const 80)
    )
   )
   (local.get $3)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $1)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $0)
   (local.get $2)
  )
  (local.get $0)
 )
 (func $assembly/atomarb.contract/TransferArgs#constructor (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (result i32)
  (local $4 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $4
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 77)
    )
   )
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (local.get $1)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $4)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:rtId
   (local.get $4)
   (local.get $3)
  )
  (local.get $4)
 )
 (func $~lib/array/Array<~lib/as-chain/action/PermissionLevel>#__uset (param $0 i32) (param $1 i32) (param $2 i32)
  (i32.store
   (i32.add
    (i32.load offset=4
     (local.get $0)
    )
    (i32.shl
     (local.get $1)
     (i32.const 2)
    )
   )
   (local.get $2)
  )
 )
 (func $~lib/as-chain/action/Action#constructor (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (result i32)
  (local $4 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $4
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 83)
    )
   )
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (local.get $1)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $4)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:rtId
   (local.get $4)
   (local.get $3)
  )
  (local.get $4)
 )
 (func $assembly/atomarb.contract/TransferArgs#pack (param $0 i32) (result i32)
  (local $1 i32)
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.tee $1
    (call $~lib/as-chain/serializer/Encoder#constructor
     (block (result i32)
      (drop
       (i32.load
        (local.get $0)
       )
      )
      (drop
       (i32.load offset=4
        (local.get $0)
       )
      )
      (drop
       (i32.load offset=8
        (local.get $0)
       )
      )
      (i32.add
       (call $~lib/as-chain/utils/Utils.calcPackedStringLength
        (i32.load offset=12
         (local.get $0)
        )
       )
       (i32.const 32)
      )
     )
    )
   )
   (i32.load
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (i32.load offset=4
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (i32.load offset=8
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packString
   (local.get $1)
   (i32.load offset=12
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#getBytes
   (local.get $1)
  )
 )
 (func $~lib/as-chain/serializer/Encoder#packName (param $0 i32) (param $1 i32)
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $0)
   (i64.load
    (local.get $1)
   )
  )
 )
 (func $~lib/as-chain/action/Action#pack (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (call $~lib/as-chain/serializer/Encoder#packName
   (local.tee $1
    (call $~lib/as-chain/serializer/Encoder#constructor
     (i32.add
      (i32.add
       (i32.add
        (i32.add
         (call $~lib/as-chain/varint/calcPackedVarUint32Length
          (i32.load offset=12
           (i32.load offset=8
            (local.get $0)
           )
          )
         )
         (i32.shl
          (i32.load offset=12
           (i32.load offset=8
            (local.get $0)
           )
          )
          (i32.const 4)
         )
        )
        (i32.const 16)
       )
       (call $~lib/as-chain/varint/calcPackedVarUint32Length
        (i32.load offset=12
         (i32.load offset=12
          (local.get $0)
         )
        )
       )
      )
      (i32.load offset=12
       (i32.load offset=12
        (local.get $0)
       )
      )
     )
    )
   )
   (i32.load
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packName
   (local.get $1)
   (i32.load offset=4
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packLength
   (local.get $1)
   (i32.load offset=12
    (i32.load offset=8
     (local.get $0)
    )
   )
  )
  (loop $for-loop|0
   (if
    (i32.lt_s
     (local.get $2)
     (i32.load offset=12
      (i32.load offset=8
       (local.get $0)
      )
     )
    )
    (block
     (call $~lib/as-chain/serializer/Encoder#pack
      (local.get $1)
      (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
       (i32.load offset=8
        (local.get $0)
       )
       (local.get $2)
      )
     )
     (local.set $2
      (i32.add
       (local.get $2)
       (i32.const 1)
      )
     )
     (br $for-loop|0)
    )
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packLength
   (local.get $1)
   (i32.load offset=12
    (local.tee $0
     (i32.load offset=12
      (local.get $0)
     )
    )
   )
  )
  (local.set $2
   (i32.load offset=4
    (local.get $0)
   )
  )
  (local.set $3
   (i32.load offset=4
    (local.get $1)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#incPos
   (local.get $1)
   (local.tee $0
    (i32.load offset=12
     (local.get $0)
    )
   )
  )
  (drop
   (call $~lib/as-chain/env/memcpy
    (i32.add
     (local.get $3)
     (i32.load offset=4
      (i32.load
       (local.get $1)
      )
     )
    )
    (local.get $2)
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#getBytes
   (local.get $1)
  )
 )
 (func $~lib/as-chain/action/Action#send (param $0 i32)
  (local $1 i32)
  (local.set $1
   (i32.load offset=12
    (local.tee $0
     (call $~lib/as-chain/action/Action#pack
      (local.get $0)
     )
    )
   )
  )
  (call $~lib/as-chain/env/send_inline
   (i32.load offset=4
    (local.get $0)
   )
   (local.get $1)
  )
 )
 (func $~lib/as-chain/helpers/InlineActionAct<assembly/atomarb.contract/TransferArgs>#send (param $0 i32) (param $1 i32)
  (local $2 i32)
  (drop
   (i32.load offset=4
    (local.tee $2
     (call $~lib/rt/__newArray
      (i32.const 1)
      (i32.const 2)
      (i32.const 82)
      (i32.const 0)
     )
    )
   )
  )
  (call $~lib/array/Array<~lib/as-chain/action/PermissionLevel>#__uset
   (local.get $2)
   (i32.const 0)
   (i32.load offset=8
    (local.get $0)
   )
  )
  (call $~lib/as-chain/action/Action#send
   (call $~lib/as-chain/action/Action#constructor
    (i32.load offset=4
     (local.get $0)
    )
    (i32.load
     (local.get $0)
    )
    (local.get $2)
    (call $assembly/atomarb.contract/TransferArgs#pack
     (local.get $1)
    )
   )
  )
 )
 (func $assembly/atomarb.contract/arbLegTwoAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/TradeRecord#set:route
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:rtSize
   (local.get $0)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/AtomArb#set:authorizedTable
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.get $1)
   )
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.tee $2
    (call $~lib/as-chain/asset/Asset#constructor@varargs)
   )
  )
  (call $assembly/atomarb.contract/AtomArb#set:tradesTable
   (local.get $0)
   (local.get $2)
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/arbLegAddAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $2)
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.tee $2
    (call $~lib/as-chain/asset/Asset#constructor@varargs)
   )
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:rtId
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:rtSize
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.get $1)
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/ammToDexAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.tee $2
    (call $~lib/as-chain/asset/Asset#constructor@varargs)
   )
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.tee $2
    (call $~lib/as-chain/asset/Asset#constructor@varargs)
   )
  )
  (call $~lib/rt/common/OBJECT#set:rtSize
   (local.get $0)
   (local.get $2)
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $~lib/util/number/decimalCount32 (param $0 i32) (result i32)
  (select
   (select
    (i32.add
     (i32.ge_u
      (local.get $0)
      (i32.const 10)
     )
     (i32.const 1)
    )
    (i32.add
     (i32.add
      (i32.ge_u
       (local.get $0)
       (i32.const 10000)
      )
      (i32.const 3)
     )
     (i32.ge_u
      (local.get $0)
      (i32.const 1000)
     )
    )
    (i32.lt_u
     (local.get $0)
     (i32.const 100)
    )
   )
   (select
    (i32.add
     (i32.ge_u
      (local.get $0)
      (i32.const 1000000)
     )
     (i32.const 6)
    )
    (i32.add
     (i32.add
      (i32.ge_u
       (local.get $0)
       (i32.const 1000000000)
      )
      (i32.const 8)
     )
     (i32.ge_u
      (local.get $0)
      (i32.const 100000000)
     )
    )
    (i32.lt_u
     (local.get $0)
     (i32.const 10000000)
    )
   )
   (i32.lt_u
    (local.get $0)
    (i32.const 100000)
   )
  )
 )
 (func $~lib/util/number/utoa_dec_simple<u32> (param $0 i32) (param $1 i32) (param $2 i32)
  (loop $do-continue|0
   (i32.store16
    (i32.add
     (local.get $0)
     (i32.shl
      (local.tee $2
       (i32.sub
        (local.get $2)
        (i32.const 1)
       )
      )
      (i32.const 1)
     )
    )
    (i32.add
     (i32.rem_u
      (local.get $1)
      (i32.const 10)
     )
     (i32.const 48)
    )
   )
   (br_if $do-continue|0
    (local.tee $1
     (i32.div_u
      (local.get $1)
      (i32.const 10)
     )
    )
   )
  )
 )
 (func $~lib/util/number/decimalCount64High (param $0 i64) (result i32)
  (select
   (select
    (i32.add
     (i32.add
      (i64.ge_u
       (local.get $0)
       (i64.const 100000000000)
      )
      (i32.const 10)
     )
     (i64.ge_u
      (local.get $0)
      (i64.const 10000000000)
     )
    )
    (i32.add
     (i32.add
      (i64.ge_u
       (local.get $0)
       (i64.const 100000000000000)
      )
      (i32.const 13)
     )
     (i64.ge_u
      (local.get $0)
      (i64.const 10000000000000)
     )
    )
    (i64.lt_u
     (local.get $0)
     (i64.const 1000000000000)
    )
   )
   (select
    (i32.add
     (i64.ge_u
      (local.get $0)
      (i64.const 10000000000000000)
     )
     (i32.const 16)
    )
    (i32.add
     (i32.add
      (i64.ge_u
       (local.get $0)
       (i64.const -8446744073709551616)
      )
      (i32.const 18)
     )
     (i64.ge_u
      (local.get $0)
      (i64.const 1000000000000000000)
     )
    )
    (i64.lt_u
     (local.get $0)
     (i64.const 100000000000000000)
    )
   )
   (i64.lt_u
    (local.get $0)
    (i64.const 1000000000000000)
   )
  )
 )
 (func $~lib/util/number/utoa_dec_simple<u64> (param $0 i32) (param $1 i64) (param $2 i32)
  (loop $do-continue|0
   (i32.store16
    (i32.add
     (local.get $0)
     (i32.shl
      (local.tee $2
       (i32.sub
        (local.get $2)
        (i32.const 1)
       )
      )
      (i32.const 1)
     )
    )
    (i32.add
     (i32.wrap_i64
      (i64.rem_u
       (local.get $1)
       (i64.const 10)
      )
     )
     (i32.const 48)
    )
   )
   (br_if $do-continue|0
    (i64.ne
     (local.tee $1
      (i64.div_u
       (local.get $1)
       (i64.const 10)
      )
     )
     (i64.const 0)
    )
   )
  )
 )
 (func $~lib/number/I64#toString (param $0 i64) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (block $__inlined_func$~lib/util/number/itoa64
   (if
    (i64.eqz
     (local.get $0)
    )
    (block
     (local.set $1
      (i32.const 4656)
     )
     (br $__inlined_func$~lib/util/number/itoa64)
    )
   )
   (if
    (i64.le_u
     (local.tee $0
      (select
       (i64.sub
        (i64.const 0)
        (local.get $0)
       )
       (local.get $0)
       (local.tee $2
        (i32.wrap_i64
         (i64.shr_u
          (local.get $0)
          (i64.const 63)
         )
        )
       )
      )
     )
     (i64.const 4294967295)
    )
    (call $~lib/util/number/utoa_dec_simple<u32>
     (local.tee $1
      (call $~lib/rt/stub/__new
       (i32.shl
        (local.tee $4
         (i32.add
          (call $~lib/util/number/decimalCount32
           (local.tee $3
            (i32.wrap_i64
             (local.get $0)
            )
           )
          )
          (local.get $2)
         )
        )
        (i32.const 1)
       )
       (i32.const 1)
      )
     )
     (local.get $3)
     (local.get $4)
    )
    (call $~lib/util/number/utoa_dec_simple<u64>
     (local.tee $1
      (call $~lib/rt/stub/__new
       (i32.shl
        (local.tee $3
         (i32.add
          (call $~lib/util/number/decimalCount64High
           (local.get $0)
          )
          (local.get $2)
         )
        )
        (i32.const 1)
       )
       (i32.const 1)
      )
     )
     (local.get $0)
     (local.get $3)
    )
   )
   (if
    (local.get $2)
    (i32.store16
     (local.get $1)
     (i32.const 45)
    )
   )
  )
  (local.get $1)
 )
 (func $~lib/string/String#padStart (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local.set $4
   (i32.shl
    (call $~lib/string/String#get:length
     (local.get $0)
    )
    (i32.const 1)
   )
  )
  (if
   (select
    (i32.const 1)
    (i32.eqz
     (local.tee $3
      (i32.shl
       (call $~lib/string/String#get:length
        (i32.const 4656)
       )
       (i32.const 1)
      )
     )
    )
    (i32.gt_u
     (local.get $4)
     (local.tee $2
      (i32.shl
       (local.get $1)
       (i32.const 1)
      )
     )
    )
   )
   (return
    (local.get $0)
   )
  )
  (local.set $1
   (call $~lib/rt/stub/__new
    (local.get $2)
    (i32.const 1)
   )
  )
  (if
   (i32.gt_u
    (local.tee $2
     (i32.sub
      (local.get $2)
      (local.get $4)
     )
    )
    (local.get $3)
   )
   (block
    (local.set $7
     (i32.mul
      (local.tee $5
       (i32.div_u
        (i32.sub
         (local.get $2)
         (i32.const 2)
        )
        (local.get $3)
       )
      )
      (local.get $3)
     )
    )
    (local.set $5
     (i32.mul
      (local.get $3)
      (local.get $5)
     )
    )
    (loop $while-continue|0
     (if
      (i32.gt_u
       (local.get $5)
       (local.get $6)
      )
      (block
       (call $~lib/memory/memory.copy
        (i32.add
         (local.get $1)
         (local.get $6)
        )
        (i32.const 4656)
        (local.get $3)
       )
       (local.set $6
        (i32.add
         (local.get $3)
         (local.get $6)
        )
       )
       (br $while-continue|0)
      )
     )
    )
    (call $~lib/memory/memory.copy
     (i32.add
      (local.get $1)
      (local.get $7)
     )
     (i32.const 4656)
     (i32.sub
      (local.get $2)
      (local.get $7)
     )
    )
   )
   (call $~lib/memory/memory.copy
    (local.get $1)
    (i32.const 4656)
    (local.get $2)
   )
  )
  (call $~lib/memory/memory.copy
   (i32.add
    (local.get $1)
    (local.get $2)
   )
   (local.get $0)
   (local.get $4)
  )
  (local.get $1)
 )
 (func $~lib/string/String#slice (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (local $3 i32)
  (local.set $3
   (call $~lib/string/String#get:length
    (local.get $0)
   )
  )
  (local.set $1
   (if (result i32)
    (i32.lt_s
     (local.get $1)
     (i32.const 0)
    )
    (select
     (local.tee $1
      (i32.add
       (local.get $1)
       (local.get $3)
      )
     )
     (i32.const 0)
     (i32.gt_s
      (local.get $1)
      (i32.const 0)
     )
    )
    (select
     (local.get $1)
     (local.get $3)
     (i32.lt_s
      (local.get $1)
      (local.get $3)
     )
    )
   )
  )
  (if
   (i32.le_s
    (local.tee $2
     (i32.sub
      (if (result i32)
       (i32.lt_s
        (local.get $2)
        (i32.const 0)
       )
       (select
        (local.tee $2
         (i32.add
          (local.get $2)
          (local.get $3)
         )
        )
        (i32.const 0)
        (i32.gt_s
         (local.get $2)
         (i32.const 0)
        )
       )
       (select
        (local.get $2)
        (local.get $3)
        (i32.lt_s
         (local.get $2)
         (local.get $3)
        )
       )
      )
      (local.get $1)
     )
    )
    (i32.const 0)
   )
   (return
    (i32.const 2448)
   )
  )
  (call $~lib/memory/memory.copy
   (local.tee $3
    (call $~lib/rt/stub/__new
     (local.tee $2
      (i32.shl
       (local.get $2)
       (i32.const 1)
      )
     )
     (i32.const 1)
    )
   )
   (i32.add
    (local.get $0)
    (i32.shl
     (local.get $1)
     (i32.const 1)
    )
   )
   (local.get $2)
  )
  (local.get $3)
 )
 (func $~lib/typedarray/Uint8Array#constructor (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (block (result i32)
    (if
     (i32.eqz
      (local.tee $1
       (call $~lib/rt/stub/__new
        (i32.const 12)
        (i32.const 87)
       )
      )
     )
     (local.set $1
      (call $~lib/rt/stub/__new
       (i32.const 12)
       (i32.const 2)
      )
     )
    )
    (local.get $1)
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $1)
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $1)
   (i32.const 0)
  )
  (if
   (i32.gt_u
    (local.get $0)
    (i32.const 1073741820)
   )
   (unreachable)
  )
  (call $~lib/memory/memory.fill
   (local.tee $2
    (call $~lib/rt/stub/__new
     (local.get $0)
     (i32.const 0)
    )
   )
   (local.get $0)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $1)
   (local.get $0)
  )
  (local.get $1)
 )
 (func $~lib/as-chain/asset/Symbol#getSymbolString (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i64)
  (local $4 i32)
  (local.set $2
   (call $~lib/typedarray/Uint8Array#constructor
    (i32.const 7)
   )
  )
  (local.set $3
   (i64.load
    (local.get $0)
   )
  )
  (loop $for-loop|0
   (if
    (i32.eqz
     (i64.eqz
      (local.tee $3
       (i64.shr_u
        (local.get $3)
        (i64.const 8)
       )
      )
     )
    )
    (block
     (local.set $0
      (i32.wrap_i64
       (i64.and
        (local.get $3)
        (i64.const 255)
       )
      )
     )
     (if
      (i32.ge_u
       (local.get $1)
       (i32.load offset=8
        (local.get $2)
       )
      )
      (unreachable)
     )
     (i32.store8
      (i32.add
       (local.get $1)
       (i32.load offset=4
        (local.get $2)
       )
      )
      (local.get $0)
     )
     (local.set $1
      (i32.add
       (local.get $1)
       (i32.const 1)
      )
     )
     (br $for-loop|0)
    )
   )
  )
  (local.set $4
   (select
    (i32.const 0)
    (local.tee $0
     (i32.load offset=8
      (local.get $2)
     )
    )
    (i32.gt_s
     (local.get $0)
     (i32.const 0)
    )
   )
  )
  (call $~lib/memory/memory.copy
   (i32.load offset=4
    (local.tee $1
     (call $~lib/typedarray/Uint8Array#constructor
      (local.tee $0
       (select
        (local.tee $0
         (i32.sub
          (if (result i32)
           (i32.lt_s
            (local.get $1)
            (i32.const 0)
           )
           (select
            (local.tee $0
             (i32.add
              (local.get $0)
              (local.get $1)
             )
            )
            (i32.const 0)
            (i32.gt_s
             (local.get $0)
             (i32.const 0)
            )
           )
           (select
            (local.get $1)
            (local.get $0)
            (i32.gt_s
             (local.get $0)
             (local.get $1)
            )
           )
          )
          (local.get $4)
         )
        )
        (i32.const 0)
        (i32.gt_s
         (local.get $0)
         (i32.const 0)
        )
       )
      )
     )
    )
   )
   (i32.add
    (local.get $4)
    (i32.load offset=4
     (local.get $2)
    )
   )
   (local.get $0)
  )
  (call $~lib/string/String.UTF8.decode
   (i32.load
    (local.get $1)
   )
  )
 )
 (func $~lib/as-chain/asset/Asset#toString (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local.set $2
   (i32.wrap_i64
    (i64.and
     (i64.load
      (i32.load offset=8
       (local.get $0)
      )
     )
     (i64.const 255)
    )
   )
  )
  (local.set $1
   (call $~lib/string/String#padStart
    (call $~lib/number/I64#toString
     (i64.load
      (local.get $0)
     )
    )
    (i32.and
     (i32.add
      (local.get $2)
      (i32.const 1)
     )
     (i32.const 255)
    )
   )
  )
  (call $~lib/string/String.__concat
   (call $~lib/string/String.__concat
    (if (result i32)
     (local.get $2)
     (call $~lib/string/String.__concat
      (call $~lib/string/String.__concat
       (call $~lib/string/String#slice
        (local.get $1)
        (i32.const 0)
        (i32.sub
         (call $~lib/string/String#get:length
          (local.get $1)
         )
         (local.get $2)
        )
       )
       (i32.const 4784)
      )
      (call $~lib/string/String#slice
       (local.get $1)
       (i32.sub
        (call $~lib/string/String#get:length
         (local.get $1)
        )
        (local.get $2)
       )
       (call $~lib/string/String#get:length
        (local.get $1)
       )
      )
     )
     (local.get $1)
    )
    (i32.const 4816)
   )
   (call $~lib/as-chain/asset/Symbol#getSymbolString
    (i32.load offset=8
     (local.get $0)
    )
   )
  )
 )
 (func $assembly/atomarb.contract/AtomArb#ammToDex (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i64) (param $4 i32)
  (local $5 i32)
  (local $6 i64)
  (local $7 i32)
  (call $~lib/as-chain/action/requireAuth
   (local.get $1)
  )
  (call $~lib/as-chain/system/check
   (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AuthorizedUser>#exists
    (i32.load offset=20
     (local.get $0)
    )
    (i64.load
     (local.get $1)
    )
   )
   (i32.const 3632)
  )
  (call $~lib/as-chain/system/check
   (i32.ne
    (local.tee $5
     (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#get
      (i32.load offset=16
       (local.get $0)
      )
     )
    )
    (i32.const 0)
   )
   (i32.const 3296)
  )
  (call $~lib/as-chain/system/check
   (i32.eqz
    (i32.load8_u offset=4
     (local.get $5)
    )
   )
   (i32.const 3696)
  )
  (call $~lib/as-chain/system/check
   (i64.eq
    (call $~lib/as-chain/asset/Symbol#code
     (i32.load offset=8
      (local.get $2)
     )
    )
    (call $~lib/as-chain/asset/Symbol#code
     (call $~lib/as-chain/asset/Symbol#constructor
      (i32.const 4080)
      (i32.const 6)
     )
    )
   )
   (i32.const 4112)
  )
  (call $~lib/as-chain/system/check
   (i64.gt_s
    (i64.load
     (local.get $2)
    )
    (i64.const 0)
   )
   (i32.const 4192)
  )
  (call $~lib/as-chain/system/check
   (i64.eq
    (call $~lib/as-chain/asset/Symbol#code
     (i32.load offset=8
      (local.get $4)
     )
    )
    (call $~lib/as-chain/asset/Symbol#code
     (call $~lib/as-chain/asset/Symbol#constructor
      (i32.const 4272)
      (i32.const 4)
     )
    )
   )
   (i32.const 4304)
  )
  (call $~lib/as-chain/system/check
   (i64.le_u
    (i64.load
     (local.get $2)
    )
    (i64.mul
     (i64.load offset=16
      (local.get $5)
     )
     (i64.const 1000000)
    )
   )
   (i32.const 4368)
  )
  (call $~lib/as-chain/system/check
   (i32.eqz
    (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#get
     (i32.load offset=12
      (local.get $0)
     )
     (i64.load
      (local.get $1)
     )
    )
   )
   (i32.const 4464)
  )
  (local.set $6
   (i64.load
    (local.get $2)
   )
  )
  (local.set $5
   (call $assembly/atomarb.contract/ArbState#constructor
    (local.get $1)
    (i64.load
     (local.get $2)
    )
    (i64.div_s
     (i64.mul
      (if (result i64)
       (i64.ge_u
        (i64.load offset=8
         (local.get $5)
        )
        (local.get $3)
       )
       (i64.load offset=8
        (local.get $5)
       )
       (local.get $3)
      )
      (local.get $6)
     )
     (i64.const 10000)
    )
    (i32.const 1)
    (call $~lib/as-chain/asset/Symbol#code
     (call $~lib/as-chain/asset/Symbol#constructor
      (i32.const 4272)
      (i32.const 4)
     )
    )
    (call $~lib/as-chain/asset/Symbol#code
     (call $~lib/as-chain/asset/Symbol#constructor
      (i32.const 4080)
      (i32.const 6)
     )
    )
    (call $~lib/as-chain/asset/Symbol#code
     (call $~lib/as-chain/asset/Symbol#constructor
      (i32.const 4576)
      (i32.const 6)
     )
    )
    (i64.extend_i32_u
     (call $~lib/as-chain/system/currentTimeSec)
    )
   )
  )
  (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#store
   (i32.load offset=12
    (local.get $0)
   )
   (local.get $5)
   (i32.load
    (local.get $0)
   )
  )
  (local.set $5
   (call $~lib/string/String.__concat
    (i32.const 4608)
    (call $~lib/as-chain/asset/Asset#toString
     (local.get $4)
    )
   )
  )
  (local.set $7
   (call $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#constructor)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const -1267475983267528704)
  )
  (local.set $4
   (local.get $0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const 3617214756542218240)
  )
  (call $~lib/as-chain/helpers/InlineActionAct<assembly/atomarb.contract/TransferArgs>#send
   (call $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#act
    (local.get $7)
    (local.get $4)
    (call $~lib/as-chain/action/PermissionLevel#constructor
     (local.get $1)
     (local.get $0)
    )
   )
   (call $assembly/atomarb.contract/TransferArgs#constructor
    (local.get $1)
    (global.get $assembly/atomarb.contract/AMM_CONTRACT)
    (local.get $2)
    (local.get $5)
   )
  )
 )
 (func $assembly/atomarb.contract/dexToAmmAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.tee $2
    (call $~lib/as-chain/asset/Asset#constructor@varargs)
   )
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/AtomArb#dexToAmm (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i64)
  (local $4 i32)
  (local $5 i64)
  (local $6 i32)
  (call $~lib/as-chain/action/requireAuth
   (local.get $1)
  )
  (call $~lib/as-chain/system/check
   (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AuthorizedUser>#exists
    (i32.load offset=20
     (local.get $0)
    )
    (i64.load
     (local.get $1)
    )
   )
   (i32.const 3632)
  )
  (call $~lib/as-chain/system/check
   (i32.ne
    (local.tee $4
     (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#get
      (i32.load offset=16
       (local.get $0)
      )
     )
    )
    (i32.const 0)
   )
   (i32.const 3296)
  )
  (call $~lib/as-chain/system/check
   (i32.eqz
    (i32.load8_u offset=4
     (local.get $4)
    )
   )
   (i32.const 3696)
  )
  (call $~lib/as-chain/system/check
   (i64.eq
    (call $~lib/as-chain/asset/Symbol#code
     (i32.load offset=8
      (local.get $2)
     )
    )
    (call $~lib/as-chain/asset/Symbol#code
     (call $~lib/as-chain/asset/Symbol#constructor
      (i32.const 4080)
      (i32.const 6)
     )
    )
   )
   (i32.const 4112)
  )
  (call $~lib/as-chain/system/check
   (i64.gt_s
    (i64.load
     (local.get $2)
    )
    (i64.const 0)
   )
   (i32.const 4192)
  )
  (call $~lib/as-chain/system/check
   (i64.le_u
    (i64.load
     (local.get $2)
    )
    (i64.mul
     (i64.load offset=16
      (local.get $4)
     )
     (i64.const 1000000)
    )
   )
   (i32.const 4368)
  )
  (call $~lib/as-chain/system/check
   (i32.eqz
    (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#get
     (i32.load offset=12
      (local.get $0)
     )
     (i64.load
      (local.get $1)
     )
    )
   )
   (i32.const 4464)
  )
  (local.set $5
   (i64.load
    (local.get $2)
   )
  )
  (local.set $4
   (call $assembly/atomarb.contract/ArbState#constructor
    (local.get $1)
    (i64.load
     (local.get $2)
    )
    (i64.div_s
     (i64.mul
      (if (result i64)
       (i64.ge_u
        (i64.load offset=8
         (local.get $4)
        )
        (local.get $3)
       )
       (i64.load offset=8
        (local.get $4)
       )
       (local.get $3)
      )
      (local.get $5)
     )
     (i64.const 10000)
    )
    (i32.const 2)
    (call $~lib/as-chain/asset/Symbol#code
     (call $~lib/as-chain/asset/Symbol#constructor
      (i32.const 4272)
      (i32.const 4)
     )
    )
    (call $~lib/as-chain/asset/Symbol#code
     (call $~lib/as-chain/asset/Symbol#constructor
      (i32.const 4080)
      (i32.const 6)
     )
    )
    (call $~lib/as-chain/asset/Symbol#code
     (call $~lib/as-chain/asset/Symbol#constructor
      (i32.const 4576)
      (i32.const 6)
     )
    )
    (i64.extend_i32_u
     (call $~lib/as-chain/system/currentTimeSec)
    )
   )
  )
  (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#store
   (i32.load offset=12
    (local.get $0)
   )
   (local.get $4)
   (i32.load
    (local.get $0)
   )
  )
  (local.set $6
   (call $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#constructor)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const -1267475983267528704)
  )
  (local.set $4
   (local.get $0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const 3617214756542218240)
  )
  (call $~lib/as-chain/helpers/InlineActionAct<assembly/atomarb.contract/TransferArgs>#send
   (call $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#act
    (local.get $6)
    (local.get $4)
    (call $~lib/as-chain/action/PermissionLevel#constructor
     (local.get $1)
     (local.get $0)
    )
   )
   (call $assembly/atomarb.contract/TransferArgs#constructor
    (local.get $1)
    (global.get $assembly/atomarb.contract/TREASURY_CONTRACT)
    (local.get $2)
    (i32.const 4848)
   )
  )
 )
 (func $assembly/atomarb.contract/redeemXmdAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.tee $2
    (call $~lib/as-chain/asset/Asset#constructor@varargs)
   )
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $2)
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/swapXprAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.tee $2
    (call $~lib/as-chain/asset/Asset#constructor@varargs)
   )
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $2)
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.tee $2
    (call $~lib/as-chain/asset/Asset#constructor@varargs)
   )
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $0)
   (local.get $2)
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/dexDepositAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $2)
  )
  (global.set $~argumentsLength
   (i32.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.tee $2
    (call $~lib/as-chain/asset/Asset#constructor@varargs)
   )
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $0)
   (local.get $2)
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/dexOrderAction#set:order_type (param $0 i32) (param $1 i32)
  (i32.store8 offset=17
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/dexOrderAction#set:bid_precision (param $0 i32) (param $1 i32)
  (i32.store8 offset=44
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/dexOrderAction#set:ask_symbol_str (param $0 i32) (param $1 i32)
  (i32.store offset=48
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/dexOrderAction#set:ask_precision (param $0 i32) (param $1 i32)
  (i32.store8 offset=52
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/dexOrderAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/addAmmPoolAction#set:quote_precision
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/dexOrderAction#set:order_type
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/Config#set:total_trades
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:base_symbol
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/AtomArb#set:legBalanceTable
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/dexOrderAction#set:bid_precision
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/dexOrderAction#set:ask_symbol_str
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/dexOrderAction#set:ask_precision
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/PlaceOrderArgs#set:ask_symbol (param $0 i32) (param $1 i32)
  (i32.store offset=44
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/PlaceOrderArgs#set:referrer (param $0 i32) (param $1 i32)
  (i32.store offset=60
   (local.get $0)
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/PlaceOrderArgs#pack (param $0 i32) (result i32)
  (local $1 i32)
  (drop
   (i32.load
    (local.get $0)
   )
  )
  (drop
   (i32.load offset=40
    (local.get $0)
   )
  )
  (drop
   (i32.load offset=44
    (local.get $0)
   )
  )
  (drop
   (i32.load offset=60
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.tee $1
    (call $~lib/as-chain/serializer/Encoder#constructor
     (i32.const 67)
    )
   )
   (i32.load
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=8
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
   (local.get $1)
   (i32.load8_u offset=16
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
   (local.get $1)
   (i32.load8_u offset=17
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=24
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=32
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (i32.load offset=40
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (i32.load offset=44
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=48
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
   (local.get $1)
   (i32.load8_u offset=56
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (i32.load offset=60
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#getBytes
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/AtomArb#dexOrder (param $0 i32) (param $1 i32) (param $2 i64) (param $3 i32) (param $4 i32) (param $5 i64) (param $6 i64) (param $7 i32) (param $8 i32) (param $9 i32) (param $10 i32)
  (local $11 i32)
  (local $12 i64)
  (call $~lib/as-chain/action/requireAuth
   (local.get $1)
  )
  (call $~lib/as-chain/system/check
   (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AuthorizedUser>#exists
    (i32.load offset=20
     (local.get $0)
    )
    (i64.load
     (local.get $1)
    )
   )
   (i32.const 3632)
  )
  (local.set $11
   (call $~lib/as-chain/asset/Symbol#constructor
    (local.get $7)
    (local.get $8)
   )
  )
  (local.set $9
   (call $~lib/as-chain/asset/Symbol#constructor
    (local.get $9)
    (local.get $10)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 4)
     (i32.const 94)
    )
   )
   (i32.const 0)
  )
  (local.set $12
   (call $~lib/as-chain/name/S2N
    (i32.const 5152)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $7
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $7)
   (local.get $12)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $7)
  )
  (local.set $8
   (global.get $assembly/atomarb.contract/DEX_CONTRACT)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $7
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $7)
   (i64.const 3617214756542218240)
  )
  (local.set $10
   (call $~lib/as-chain/action/PermissionLevel#constructor
    (local.get $1)
    (local.get $7)
   )
  )
  (local.set $0
   (i32.load
    (local.get $0)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $7
    (call $~lib/rt/stub/__new
     (i32.const 12)
     (i32.const 95)
    )
   )
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $7)
   (local.get $8)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $7)
   (local.get $10)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $8
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $8)
   (i64.const 0)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 64)
     (i32.const 93)
    )
   )
   (local.get $1)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/addAmmPoolAction#set:quote_precision
   (local.get $0)
   (local.get $3)
  )
  (call $assembly/atomarb.contract/dexOrderAction#set:order_type
   (local.get $0)
   (local.get $4)
  )
  (call $assembly/atomarb.contract/Config#set:total_trades
   (local.get $0)
   (local.get $5)
  )
  (call $assembly/atomarb.contract/ArbState#set:base_symbol
   (local.get $0)
   (local.get $6)
  )
  (call $assembly/atomarb.contract/AtomArb#set:legBalanceTable
   (local.get $0)
   (local.get $11)
  )
  (call $assembly/atomarb.contract/PlaceOrderArgs#set:ask_symbol
   (local.get $0)
   (local.get $9)
  )
  (call $assembly/atomarb.contract/ArbState#set:intermediate_symbol
   (local.get $0)
   (i64.const 0)
  )
  (call $assembly/atomarb.contract/DexMarket#set:enabled
   (local.get $0)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/PlaceOrderArgs#set:referrer
   (local.get $0)
   (local.get $8)
  )
  (drop
   (i32.load offset=4
    (local.tee $1
     (call $~lib/rt/__newArray
      (i32.const 1)
      (i32.const 2)
      (i32.const 82)
      (i32.const 0)
     )
    )
   )
  )
  (call $~lib/array/Array<~lib/as-chain/action/PermissionLevel>#__uset
   (local.get $1)
   (i32.const 0)
   (i32.load offset=8
    (local.get $7)
   )
  )
  (call $~lib/as-chain/action/Action#send
   (call $~lib/as-chain/action/Action#constructor
    (i32.load offset=4
     (local.get $7)
    )
    (i32.load
     (local.get $7)
    )
    (local.get $1)
    (call $assembly/atomarb.contract/PlaceOrderArgs#pack
     (local.get $0)
    )
   )
  )
 )
 (func $assembly/atomarb.contract/WithdrawArgs#pack (param $0 i32) (result i32)
  (local $1 i32)
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.tee $1
    (call $~lib/as-chain/serializer/Encoder#constructor
     (block (result i32)
      (drop
       (i32.load
        (local.get $0)
       )
      )
      (drop
       (i32.load offset=4
        (local.get $0)
       )
      )
      (i32.const 24)
     )
    )
   )
   (i32.load
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (i32.load offset=4
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#getBytes
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/AtomArb#dexWithdraw (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i64)
  (local $5 i32)
  (local $6 i32)
  (call $~lib/as-chain/action/requireAuth
   (local.get $1)
  )
  (call $~lib/as-chain/system/check
   (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AuthorizedUser>#exists
    (i32.load offset=20
     (local.get $0)
    )
    (i64.load
     (local.get $1)
    )
   )
   (i32.const 3632)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 4)
     (i32.const 98)
    )
   )
   (i32.const 0)
  )
  (local.set $4
   (call $~lib/as-chain/name/S2N
    (i32.const 5200)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $3
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $3)
   (local.get $4)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $3)
  )
  (local.set $5
   (global.get $assembly/atomarb.contract/DEX_CONTRACT)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $3
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $3)
   (i64.const 3617214756542218240)
  )
  (local.set $3
   (call $~lib/as-chain/action/PermissionLevel#constructor
    (local.get $1)
    (local.get $3)
   )
  )
  (local.set $6
   (i32.load
    (local.get $0)
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 12)
     (i32.const 99)
    )
   )
   (local.get $6)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $5)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $0)
   (local.get $3)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $3
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 97)
    )
   )
   (local.get $1)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $3)
   (local.get $2)
  )
  (drop
   (i32.load offset=4
    (local.tee $1
     (call $~lib/rt/__newArray
      (i32.const 1)
      (i32.const 2)
      (i32.const 82)
      (i32.const 0)
     )
    )
   )
  )
  (call $~lib/array/Array<~lib/as-chain/action/PermissionLevel>#__uset
   (local.get $1)
   (i32.const 0)
   (i32.load offset=8
    (local.get $0)
   )
  )
  (call $~lib/as-chain/action/Action#send
   (call $~lib/as-chain/action/Action#constructor
    (i32.load offset=4
     (local.get $0)
    )
    (i32.load
     (local.get $0)
    )
    (local.get $1)
    (call $assembly/atomarb.contract/WithdrawArgs#pack
     (local.get $3)
    )
   )
  )
 )
 (func $assembly/atomarb.contract/checkBalExtAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/TradeRecord#set:route
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (call $~lib/rt/common/OBJECT#set:rtSize
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackString
    (local.get $1)
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#requireGet (param $0 i32) (param $1 i64) (result i32)
  (local $2 i32)
  (call $~lib/as-chain/system/check
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
    (local.tee $2
     (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/ArbState>#find
      (i32.load
       (local.get $0)
      )
      (local.get $1)
     )
    )
   )
   (i32.const 5248)
  )
  (if (result i32)
   (local.tee $0
    (call $~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/ArbState>#get
     (i32.load
      (i32.load
       (local.get $0)
      )
     )
     (local.get $2)
    )
   )
   (local.get $0)
   (block (result i32)
    (global.set $~argumentsLength
     (i32.const 0)
    )
    (call $assembly/atomarb.contract/ArbState#constructor@varargs)
   )
  )
 )
 (func $~lib/number/U64#toString (param $0 i64) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (block $__inlined_func$~lib/util/number/utoa64
   (if
    (i64.eqz
     (local.get $0)
    )
    (block
     (local.set $1
      (i32.const 4656)
     )
     (br $__inlined_func$~lib/util/number/utoa64)
    )
   )
   (if
    (i64.le_u
     (local.get $0)
     (i64.const 4294967295)
    )
    (call $~lib/util/number/utoa_dec_simple<u32>
     (local.tee $1
      (call $~lib/rt/stub/__new
       (i32.shl
        (local.tee $3
         (call $~lib/util/number/decimalCount32
          (local.tee $2
           (i32.wrap_i64
            (local.get $0)
           )
          )
         )
        )
        (i32.const 1)
       )
       (i32.const 1)
      )
     )
     (local.get $2)
     (local.get $3)
    )
    (call $~lib/util/number/utoa_dec_simple<u64>
     (local.tee $1
      (call $~lib/rt/stub/__new
       (i32.shl
        (local.tee $2
         (call $~lib/util/number/decimalCount64High
          (local.get $0)
         )
        )
        (i32.const 1)
       )
       (i32.const 1)
      )
     )
     (local.get $0)
     (local.get $2)
    )
   )
  )
  (local.get $1)
 )
 (func $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/TradeRecord>#constructor (param $0 i32) (param $1 i32) (param $2 i64) (param $3 i32) (result i32)
  (local $4 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $4
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 101)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (i32.const 0)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (i64.const 0)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $4)
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (local.get $1)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (local.get $2)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (local.get $3)
  )
  (local.get $4)
 )
 (func $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/TradeRecord>#end (param $0 i32) (result i32)
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/TradeRecord>#constructor
   (local.tee $0
    (i32.load
     (local.get $0)
    )
   )
   (call $~lib/as-chain/env/db_end_i64
    (i64.load
     (local.get $0)
    )
    (i64.load offset=8
     (local.get $0)
    )
    (i64.load offset=16
     (local.get $0)
    )
   )
   (i64.const 0)
   (i32.const 0)
  )
 )
 (func $~lib/as-chain/serializer/Decoder#unpackNumber<i64> (param $0 i32) (result i64)
  (local $1 i64)
  (local.set $1
   (i64.load
    (i32.add
     (i32.load offset=4
      (i32.load
       (local.get $0)
      )
     )
     (i32.load offset=4
      (local.get $0)
     )
    )
   )
  )
  (call $~lib/as-chain/serializer/Decoder#incPos
   (local.get $0)
   (i32.const 8)
  )
  (local.get $1)
 )
 (func $assembly/atomarb.contract/TradeRecord#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.tee $1
     (call $~lib/as-chain/serializer/Decoder#constructor
      (local.get $1)
     )
    )
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $0)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/TradeRecord#set:route
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/Config#set:total_trades
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:base_symbol
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:quote_symbol
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:intermediate_symbol
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<i64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:started_at
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TradeRecord>#get:availablePrimaryKey (param $0 i32) (result i64)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i64)
  (local $5 i64)
  (if
   (i64.eq
    (i64.load offset=8
     (local.get $0)
    )
    (i64.const -1)
   )
   (if
    (i32.eq
     (i32.load offset=4
      (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/TradeRecord>#constructor
       (local.tee $1
        (i32.load
         (i32.load
          (local.get $0)
         )
        )
       )
       (call $~lib/as-chain/env/db_lowerbound_i64
        (i64.load
         (local.get $1)
        )
        (i64.load offset=8
         (local.get $1)
        )
        (i64.load offset=16
         (local.get $1)
        )
        (i64.const 0)
       )
       (i64.const 0)
       (i32.const 0)
      )
     )
     (i32.load offset=4
      (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/TradeRecord>#end
       (i32.load
        (local.get $0)
       )
      )
     )
    )
    (call $assembly/atomarb.contract/ArbState#set:starting_balance
     (local.get $0)
     (i64.const 0)
    )
    (block
     (local.set $2
      (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/TradeRecord>#end
       (i32.load
        (local.get $0)
       )
      )
     )
     (local.set $1
      (i32.load
       (i32.load
        (local.get $0)
       )
      )
     )
     (local.set $3
      (call $~lib/rt/stub/__alloc
       (i32.const 8)
      )
     )
     (local.set $2
      (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/TradeRecord>#constructor
       (local.get $1)
       (call $~lib/as-chain/env/db_previous_i64
        (i32.load offset=4
         (local.get $2)
        )
        (local.get $3)
       )
       (i64.load
        (local.get $3)
       )
       (i32.const 1)
      )
     )
     (drop
      (i32.load
       (i32.load
        (local.get $0)
       )
      )
     )
     (block $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/TradeRecord>#get
      (if
       (i32.eqz
        (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
         (local.get $2)
        )
       )
       (block
        (local.set $1
         (i32.const 0)
        )
        (br $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/TradeRecord>#get)
       )
      )
      (local.set $1
       (i32.const 0)
      )
      (if
       (local.tee $3
        (call $~lib/as-chain/env/db_get_i64
         (local.tee $2
          (i32.load offset=4
           (local.get $2)
          )
         )
         (i32.const 0)
         (i32.const 0)
        )
       )
       (block
        (drop
         (call $~lib/as-chain/env/db_get_i64
          (local.get $2)
          (i32.load offset=4
           (local.tee $2
            (call $~lib/array/Array<u8>#constructor
             (local.get $3)
            )
           )
          )
          (local.get $3)
         )
        )
        (global.set $~argumentsLength
         (i32.const 0)
        )
        (drop
         (call $assembly/atomarb.contract/TradeRecord#unpack
          (local.tee $1
           (call $assembly/atomarb.contract/TradeRecord#constructor@varargs)
          )
          (local.get $2)
         )
        )
       )
      )
     )
     (local.set $5
      (local.tee $4
       (i64.load
        (if (result i32)
         (local.get $1)
         (local.get $1)
         (block (result i32)
          (global.set $~argumentsLength
           (i32.const 0)
          )
          (call $assembly/atomarb.contract/TradeRecord#constructor@varargs)
         )
        )
       )
      )
     )
     (if
      (i64.ge_u
       (local.get $4)
       (i64.const -2)
      )
      (call $assembly/atomarb.contract/ArbState#set:starting_balance
       (local.get $0)
       (i64.const -2)
      )
      (call $assembly/atomarb.contract/ArbState#set:starting_balance
       (local.get $0)
       (i64.add
        (local.get $5)
        (i64.const 1)
       )
      )
     )
    )
   )
  )
  (call $~lib/as-chain/system/check
   (i64.lt_u
    (i64.load offset=8
     (local.get $0)
    )
    (i64.const -2)
   )
   (i32.const 2160)
  )
  (i64.load offset=8
   (local.get $0)
  )
 )
 (func $assembly/atomarb.contract/TradeRecord#pack (param $0 i32) (result i32)
  (local $1 i32)
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.tee $1
    (call $~lib/as-chain/serializer/Encoder#constructor
     (block (result i32)
      (drop
       (i32.load offset=8
        (local.get $0)
       )
      )
      (i32.const 65)
     )
    )
   )
   (i64.load
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (i32.load offset=8
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
   (local.get $1)
   (i32.load8_u offset=12
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=16
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=24
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=32
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=40
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=48
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
   (local.get $1)
   (i64.load offset=56
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#getBytes
   (local.get $1)
  )
 )
 (func $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TradeRecord>#store (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i64)
  (local $5 i32)
  (local $6 i64)
  (local $7 i32)
  (local $8 i64)
  (local $9 i32)
  (local $10 i32)
  (local.set $4
   (local.tee $6
    (i64.load
     (local.get $1)
    )
   )
  )
  (call $~lib/as-chain/system/check
   (i32.eqz
    (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
     (block $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/TradeRecord>#find (result i32)
      (if
       (i32.ge_s
        (local.tee $5
         (call $~lib/as-chain/env/db_find_i64
          (i64.load
           (local.tee $3
            (i32.load
             (i32.load
              (local.get $0)
             )
            )
           )
          )
          (i64.load offset=8
           (local.get $3)
          )
          (i64.load offset=16
           (local.get $3)
          )
          (local.get $6)
         )
        )
        (i32.const 0)
       )
       (br $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/TradeRecord>#find
        (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/TradeRecord>#constructor
         (local.get $3)
         (local.get $5)
         (local.get $4)
         (i32.const 1)
        )
       )
      )
      (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/TradeRecord>#constructor
       (local.get $3)
       (local.get $5)
       (i64.const 0)
       (i32.const 0)
      )
     )
    )
   )
   (i32.const 1200)
  )
  (local.set $3
   (i32.const 0)
  )
  (local.set $4
   (i64.load
    (local.get $1)
   )
  )
  (local.set $8
   (i64.load
    (local.get $2)
   )
  )
  (local.set $7
   (i32.load
    (local.tee $5
     (i32.load
      (local.get $0)
     )
    )
   )
  )
  (local.set $10
   (i32.load offset=12
    (local.tee $9
     (call $assembly/atomarb.contract/TradeRecord#pack
      (local.get $1)
     )
    )
   )
  )
  (drop
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/TradeRecord>#constructor
    (local.get $7)
    (call $~lib/as-chain/env/db_store_i64
     (i64.load offset=8
      (local.get $7)
     )
     (i64.load offset=16
      (local.get $7)
     )
     (local.get $8)
     (local.get $4)
     (i32.load offset=4
      (local.get $9)
     )
     (local.get $10)
    )
    (local.get $4)
    (i32.const 1)
   )
  )
  (loop $for-loop|0
   (if
    (i32.lt_s
     (local.get $3)
     (i32.load offset=12
      (i32.load offset=4
       (local.get $5)
      )
     )
    )
    (block
     (call $~lib/as-chain/idxdb/IDXDB#storeEx@virtual
      (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
       (i32.load offset=4
        (local.get $5)
       )
       (local.get $3)
      )
      (i64.load
       (local.get $1)
      )
      (call $assembly/atomarb.contract/Config#getSecondaryValue)
      (i64.load
       (local.get $2)
      )
     )
     (local.set $3
      (i32.add
       (local.get $3)
       (i32.const 1)
      )
     )
     (br $for-loop|0)
    )
   )
  )
  (if
   (i64.ge_u
    (local.tee $4
     (i64.load
      (local.get $1)
     )
    )
    (i64.load offset=8
     (local.get $5)
    )
   )
   (call $assembly/atomarb.contract/ArbState#set:starting_balance
    (local.get $5)
    (select
     (i64.const -2)
     (i64.add
      (local.get $4)
      (i64.const 1)
     )
     (i64.ge_u
      (local.get $4)
      (i64.const -2)
     )
    )
   )
  )
  (if
   (i64.ge_u
    (local.get $6)
    (i64.load offset=8
     (local.get $0)
    )
   )
   (call $assembly/atomarb.contract/ArbState#set:starting_balance
    (local.get $0)
    (select
     (i64.const -2)
     (i64.add
      (local.get $6)
      (i64.const 1)
     )
     (i64.ge_u
      (local.get $6)
      (i64.const -2)
     )
    )
   )
  )
 )
 (func $~lib/as-chain/debug/print (param $0 i32)
  (local.set $0
   (call $~lib/string/String.UTF8.encode
    (local.get $0)
    (i32.const 0)
   )
  )
  (global.set $~argumentsLength
   (i32.const 1)
  )
  (call $~lib/as-chain/env/prints_l
   (i32.load offset=4
    (local.tee $0
     (call $~lib/dataview/DataView#constructor@varargs
      (local.get $0)
     )
    )
   )
   (i32.load offset=8
    (local.get $0)
   )
  )
 )
 (func $assembly/atomarb.contract/AtomArb#checkBalExt (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32)
  (local $6 i32)
  (local $7 i64)
  (local $8 i64)
  (call $~lib/as-chain/action/requireAuth
   (local.get $1)
  )
  (local.set $6
   (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#requireGet
    (i32.load offset=12
     (local.get $0)
    )
    (i64.load
     (local.get $1)
    )
   )
  )
  (call $~lib/as-chain/system/check
   (i64.ge_s
    (local.tee $7
     (i64.sub
      (local.tee $8
       (i64.load
        (call $assembly/atomarb.contract/getBalance
         (local.get $2)
         (local.get $1)
         (call $~lib/as-chain/asset/Symbol#constructor
          (local.get $3)
          (local.get $4)
         )
        )
       )
      )
      (i64.load offset=8
       (local.get $6)
      )
     )
    )
    (i64.load offset=16
     (local.get $6)
    )
   )
   (call $~lib/string/String.__concat
    (call $~lib/string/String.__concat
     (call $~lib/string/String.__concat
      (call $~lib/string/String.__concat
       (call $~lib/string/String.__concat
        (i32.const 5312)
        (local.get $5)
       )
       (i32.const 5360)
      )
      (call $~lib/number/I64#toString
       (local.get $7)
      )
     )
     (i32.const 5408)
    )
    (call $~lib/number/U64#toString
     (i64.load offset=16
      (local.get $6)
     )
    )
   )
  )
  (call $assembly/atomarb.contract/Config#set:total_trades
   (local.tee $2
    (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#get
     (i32.load offset=16
      (local.get $0)
     )
    )
   )
   (i64.add
    (i64.load offset=24
     (local.get $2)
    )
    (i64.const 1)
   )
  )
  (if
   (i64.gt_s
    (local.get $7)
    (i64.const 0)
   )
   (call $assembly/atomarb.contract/ArbState#set:base_symbol
    (local.get $2)
    (i64.add
     (local.get $7)
     (i64.load offset=32
      (local.get $2)
     )
    )
   )
  )
  (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#set
   (i32.load offset=16
    (local.get $0)
   )
   (local.get $2)
   (i32.load
    (local.get $0)
   )
  )
  (local.set $1
   (call $assembly/atomarb.contract/TradeRecord#constructor
    (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TradeRecord>#get:availablePrimaryKey
     (i32.load offset=24
      (local.get $0)
     )
    )
    (local.get $1)
    (i32.load8_u offset=24
     (local.get $6)
    )
    (i64.load offset=32
     (local.get $6)
    )
    (i64.load offset=40
     (local.get $6)
    )
    (i64.load offset=8
     (local.get $6)
    )
    (local.get $8)
    (local.get $7)
    (i64.extend_i32_u
     (call $~lib/as-chain/system/currentTimeSec)
    )
   )
  )
  (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TradeRecord>#store
   (i32.load offset=24
    (local.get $0)
   )
   (local.get $1)
   (i32.load
    (local.get $0)
   )
  )
  (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#remove
   (i32.load offset=12
    (local.get $0)
   )
   (local.get $6)
  )
  (call $~lib/as-chain/debug/print
   (call $~lib/string/String.__concat
    (call $~lib/string/String.__concat
     (call $~lib/string/String.__concat
      (i32.const 5456)
      (local.get $5)
     )
     (i32.const 5360)
    )
    (call $~lib/number/I64#toString
     (local.get $7)
    )
   )
  )
 )
 (func $assembly/atomarb.contract/AtomArb#verify (param $0 i32) (param $1 i32) (param $2 i64)
  (local $3 i32)
  (local $4 i64)
  (local $5 i32)
  (call $~lib/as-chain/action/requireAuth
   (local.get $1)
  )
  (call $~lib/as-chain/system/check
   (i64.ge_s
    (local.tee $4
     (i64.sub
      (local.get $2)
      (i64.load offset=8
       (local.tee $3
        (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#requireGet
         (i32.load offset=12
          (local.get $0)
         )
         (i64.load
          (local.get $1)
         )
        )
       )
      )
     )
    )
    (i64.load offset=16
     (local.get $3)
    )
   )
   (call $~lib/string/String.__concat
    (call $~lib/string/String.__concat
     (call $~lib/string/String.__concat
      (i32.const 5520)
      (call $~lib/number/I64#toString
       (local.get $4)
      )
     )
     (i32.const 5408)
    )
    (call $~lib/number/U64#toString
     (i64.load offset=16
      (local.get $3)
     )
    )
   )
  )
  (call $assembly/atomarb.contract/Config#set:total_trades
   (local.tee $5
    (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#get
     (i32.load offset=16
      (local.get $0)
     )
    )
   )
   (i64.add
    (i64.load offset=24
     (local.get $5)
    )
    (i64.const 1)
   )
  )
  (if
   (i64.gt_s
    (local.get $4)
    (i64.const 0)
   )
   (call $assembly/atomarb.contract/ArbState#set:base_symbol
    (local.get $5)
    (i64.add
     (local.get $4)
     (i64.load offset=32
      (local.get $5)
     )
    )
   )
  )
  (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#set
   (i32.load offset=16
    (local.get $0)
   )
   (local.get $5)
   (i32.load
    (local.get $0)
   )
  )
  (local.set $1
   (call $assembly/atomarb.contract/TradeRecord#constructor
    (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TradeRecord>#get:availablePrimaryKey
     (i32.load offset=24
      (local.get $0)
     )
    )
    (local.get $1)
    (i32.load8_u offset=24
     (local.get $3)
    )
    (i64.load offset=32
     (local.get $3)
    )
    (i64.load offset=40
     (local.get $3)
    )
    (i64.load offset=8
     (local.get $3)
    )
    (local.get $2)
    (local.get $4)
    (i64.extend_i32_u
     (call $~lib/as-chain/system/currentTimeSec)
    )
   )
  )
  (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TradeRecord>#store
   (i32.load offset=24
    (local.get $0)
   )
   (local.get $1)
   (i32.load
    (local.get $0)
   )
  )
  (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#remove
   (i32.load offset=12
    (local.get $0)
   )
   (local.get $3)
  )
  (call $~lib/as-chain/debug/print
   (call $~lib/string/String.__concat
    (i32.const 5616)
    (call $~lib/number/I64#toString
     (local.get $4)
    )
   )
  )
 )
 (func $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/LegBalance>#constructor (param $0 i32) (param $1 i32) (param $2 i64) (param $3 i32) (result i32)
  (local $4 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $4
    (call $~lib/rt/stub/__new
     (i32.const 24)
     (i32.const 104)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (i32.const 0)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (i32.const 0)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (i64.const 0)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $4)
   (local.get $0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $4)
   (local.get $1)
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $4)
   (local.get $2)
  )
  (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
   (local.get $4)
   (local.get $3)
  )
  (local.get $4)
 )
 (func $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/LegBalance>#find (param $0 i32) (param $1 i64) (result i32)
  (local $2 i32)
  (block $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/LegBalance>#find (result i32)
   (if
    (i32.ge_s
     (local.tee $2
      (call $~lib/as-chain/env/db_find_i64
       (i64.load
        (local.tee $0
         (i32.load
          (local.get $0)
         )
        )
       )
       (i64.load offset=8
        (local.get $0)
       )
       (i64.load offset=16
        (local.get $0)
       )
       (local.get $1)
      )
     )
     (i32.const 0)
    )
    (br $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/LegBalance>#find
     (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/LegBalance>#constructor
      (local.get $0)
      (local.get $2)
      (local.get $1)
      (i32.const 1)
     )
    )
   )
   (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/LegBalance>#constructor
    (local.get $0)
    (local.get $2)
    (i64.const 0)
    (i32.const 0)
   )
  )
 )
 (func $assembly/atomarb.contract/LegBalance#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:min_profit
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:route
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/clearAction#unpack (param $0 i32) (param $1 i32) (result i32)
  (i32.load offset=4
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
 )
 (func $~lib/array/Array<u8>#__get (param $0 i32) (param $1 i32) (result i32)
  (if
   (i32.ge_u
    (local.get $1)
    (i32.load offset=12
     (local.get $0)
    )
   )
   (unreachable)
  )
  (i32.load8_u
   (i32.add
    (i32.load offset=4
     (local.get $0)
    )
    (local.get $1)
   )
  )
 )
 (func $~lib/array/ensureCapacity (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  (if
   (i32.gt_u
    (local.get $1)
    (i32.shr_u
     (local.tee $3
      (i32.load offset=8
       (local.get $0)
      )
     )
     (local.get $2)
    )
   )
   (block
    (if
     (i32.gt_u
      (local.get $1)
      (i32.shr_u
       (i32.const 1073741820)
       (local.get $2)
      )
     )
     (unreachable)
    )
    (local.set $1
     (i32.shl
      (select
       (local.get $1)
       (i32.const 8)
       (i32.gt_u
        (local.get $1)
        (i32.const 8)
       )
      )
      (local.get $2)
     )
    )
    (call $~lib/memory/memory.fill
     (i32.add
      (local.tee $2
       (call $~lib/rt/stub/__renew
        (local.tee $4
         (i32.load
          (local.get $0)
         )
        )
        (local.tee $1
         (select
          (local.tee $2
           (select
            (local.tee $2
             (i32.shl
              (local.get $3)
              (i32.const 1)
             )
            )
            (i32.const 1073741820)
            (i32.lt_u
             (local.get $2)
             (i32.const 1073741820)
            )
           )
          )
          (local.get $1)
          (i32.lt_u
           (local.get $1)
           (local.get $2)
          )
         )
        )
       )
      )
      (local.get $3)
     )
     (i32.sub
      (local.get $1)
      (local.get $3)
     )
    )
    (if
     (i32.ne
      (local.get $2)
      (local.get $4)
     )
     (block
      (i32.store
       (local.get $0)
       (local.get $2)
      )
      (i32.store offset=4
       (local.get $0)
       (local.get $2)
      )
     )
    )
    (i32.store offset=8
     (local.get $0)
     (local.get $1)
    )
   )
  )
 )
 (func $~lib/as-chain/name/N2S (param $0 i64) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local.set $2
   (call $~lib/array/Array<u8>#constructor
    (i32.const 13)
   )
  )
  (loop $for-loop|0
   (if
    (i32.le_s
     (local.get $1)
     (i32.const 12)
    )
    (block
     (local.set $3
      (i32.sub
       (i32.const 12)
       (local.get $1)
      )
     )
     (local.set $4
      (if (result i32)
       (local.get $1)
       (call $~lib/array/Array<u8>#__get
        (i32.const 1152)
        (i32.wrap_i64
         (i64.and
          (local.get $0)
          (i64.const 31)
         )
        )
       )
       (call $~lib/array/Array<u8>#__get
        (i32.const 1152)
        (i32.wrap_i64
         (i64.and
          (local.get $0)
          (i64.const 15)
         )
        )
       )
      )
     )
     (if
      (i32.ge_u
       (local.get $3)
       (i32.load offset=12
        (local.get $2)
       )
      )
      (block
       (if
        (i32.lt_s
         (local.get $3)
         (i32.const 0)
        )
        (unreachable)
       )
       (call $~lib/array/ensureCapacity
        (local.get $2)
        (local.tee $5
         (i32.add
          (local.get $3)
          (i32.const 1)
         )
        )
        (i32.const 0)
       )
       (call $~lib/rt/common/OBJECT#set:rtId
        (local.get $2)
        (local.get $5)
       )
      )
     )
     (i32.store8
      (i32.add
       (local.get $3)
       (i32.load offset=4
        (local.get $2)
       )
      )
      (local.get $4)
     )
     (local.set $0
      (select
       (i64.shr_u
        (local.get $0)
        (i64.const 5)
       )
       (i64.shr_u
        (local.get $0)
        (i64.const 4)
       )
       (local.get $1)
      )
     )
     (local.set $1
      (i32.add
       (local.get $1)
       (i32.const 1)
      )
     )
     (br $for-loop|0)
    )
   )
  )
  (local.set $1
   (i32.sub
    (i32.load offset=12
     (local.get $2)
    )
    (i32.const 1)
   )
  )
  (loop $for-loop|1
   (if
    (i32.ge_s
     (local.get $1)
     (i32.const 0)
    )
    (if
     (i32.eq
      (call $~lib/array/Array<u8>#__get
       (local.get $2)
       (local.get $1)
      )
      (i32.const 46)
     )
     (block
      (local.set $1
       (i32.sub
        (local.get $1)
        (i32.const 1)
       )
      )
      (br $for-loop|1)
     )
    )
   )
  )
  (call $~lib/string/String.UTF8.decode
   (i32.load
    (call $~lib/array/Array<u8>#slice
     (local.get $2)
     (i32.const 0)
     (i32.add
      (local.get $1)
      (i32.const 1)
     )
    )
   )
  )
 )
 (func $assembly/atomarb.contract/apply (param $0 i64) (param $1 i64) (param $2 i64)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i64)
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $3
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $3)
   (local.get $0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $6
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $6)
   (local.get $1)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $8
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $8)
   (local.get $2)
  )
  (local.set $6
   (call $assembly/atomarb.contract/AtomArb#constructor
    (local.get $3)
    (local.get $6)
    (local.get $8)
   )
  )
  (drop
   (call $~lib/as-chain/env/read_action_data
    (i32.load offset=4
     (local.tee $8
      (call $~lib/array/Array<u8>#constructor
       (local.tee $3
        (call $~lib/as-chain/env/action_data_size)
       )
      )
     )
    )
    (local.get $3)
   )
  )
  (if
   (i64.eq
    (local.get $0)
    (local.get $1)
   )
   (block
    (if
     (i64.eq
      (local.get $2)
      (i64.const 8421045207927095296)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 4)
         (i32.const 46)
        )
       )
       (i32.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/initAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $3
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (call $~lib/as-chain/action/requireAuth
       (i32.load
        (local.get $6)
       )
      )
      (if
       (if (result i32)
        (local.tee $4
         (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#get
          (i32.load offset=16
           (local.get $6)
          )
         )
        )
        (i64.ne
         (i64.load
          (i32.load
           (local.get $4)
          )
         )
         (i64.const 0)
        )
        (i32.const 0)
       )
       (call $~lib/as-chain/action/requireAuth
        (i32.load
         (local.get $4)
        )
       )
      )
      (call $~lib/as-chain/system/check
       (call $~lib/as-chain/action/isAccount
        (local.get $3)
       )
       (i32.const 2736)
      )
      (local.set $4
       (call $assembly/atomarb.contract/Config#constructor
        (local.get $3)
       )
      )
      (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#set
       (i32.load offset=16
        (local.get $6)
       )
       (local.get $4)
       (i32.load
        (local.get $6)
       )
      )
      (local.set $3
       (call $assembly/atomarb.contract/AuthorizedUser#constructor
        (local.get $3)
        (i64.extend_i32_u
         (call $~lib/as-chain/system/currentTimeSec)
        )
       )
      )
      (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AuthorizedUser>#store
       (i32.load offset=20
        (local.get $6)
       )
       (local.get $3)
       (i32.load
        (local.get $6)
       )
      )
      (call $assembly/atomarb.contract/AtomArb#setupDefaultTokens
       (local.get $6)
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const 3626411730319441920)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 9)
         (i32.const 59)
        )
       )
       (i32.const 2448)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo
       (local.get $3)
       (i32.const 0)
      )
      (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
       (local.get $3)
       (i32.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/addTokenAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (local.set $4
       (i32.load
        (local.get $3)
       )
      )
      (if
       (i32.eqz
        (local.tee $9
         (i32.load offset=4
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (local.set $7
       (i32.load8_u offset=8
        (local.get $3)
       )
      )
      (call $~lib/as-chain/system/check
       (i32.ne
        (local.tee $3
         (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#get
          (i32.load offset=16
           (local.get $6)
          )
         )
        )
        (i32.const 0)
       )
       (i32.const 3296)
      )
      (call $~lib/as-chain/action/requireAuth
       (i32.load
        (local.get $3)
       )
      )
      (local.set $0
       (call $~lib/as-chain/asset/Symbol#code
        (call $~lib/as-chain/asset/Symbol#constructor
         (local.get $4)
         (local.get $7)
        )
       )
      )
      (local.set $3
       (i32.const 0)
      )
      (if
       (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
        (local.tee $4
         (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/TokenMap>#find
          (local.tee $5
           (i32.load
            (i32.load offset=28
             (local.get $6)
            )
           )
          )
          (local.get $0)
         )
        )
       )
       (block
        (drop
         (i32.load
          (local.get $5)
         )
        )
        (if
         (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
          (local.get $4)
         )
         (if
          (local.tee $4
           (call $~lib/as-chain/env/db_get_i64
            (local.tee $5
             (i32.load offset=4
              (local.get $4)
             )
            )
            (i32.const 0)
            (i32.const 0)
           )
          )
          (block
           (drop
            (call $~lib/as-chain/env/db_get_i64
             (local.get $5)
             (i32.load offset=4
              (local.tee $5
               (call $~lib/array/Array<u8>#constructor
                (local.get $4)
               )
              )
             )
             (local.get $4)
            )
           )
           (global.set $~argumentsLength
            (i32.const 0)
           )
           (drop
            (call $assembly/atomarb.contract/TokenMap#unpack
             (local.tee $3
              (call $assembly/atomarb.contract/TokenMap#constructor@varargs)
             )
             (local.get $5)
            )
           )
          )
         )
        )
       )
      )
      (if
       (local.get $3)
       (block
        (call $~lib/as-chain/system/check
         (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
          (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/TokenMap>#find
           (i32.load
            (local.tee $5
             (i32.load offset=28
              (local.get $6)
             )
            )
           )
           (local.tee $1
            (i64.load
             (local.get $3)
            )
           )
          )
         )
         (i32.const 1648)
        )
        (local.set $3
         (i32.const 0)
        )
        (call $~lib/as-chain/system/check
         (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
          (local.tee $10
           (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/TokenMap>#find
            (local.tee $4
             (i32.load
              (local.get $5)
             )
            )
            (local.get $1)
           )
          )
         )
         (i32.const 3488)
        )
        (call $~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/TokenMap>#remove
         (i32.load
          (local.get $4)
         )
         (local.get $10)
        )
        (loop $for-loop|0
         (if
          (i32.lt_s
           (local.get $3)
           (i32.load offset=12
            (i32.load offset=4
             (local.get $4)
            )
           )
          )
          (block
           (if
            (call $~lib/as-chain/idxdb/SecondaryIterator#isOk
             (i32.load
              (local.tee $10
               (call $~lib/as-chain/idxdb/IDXDB#findPrimaryEx@virtual
                (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
                 (i32.load offset=4
                  (local.get $4)
                 )
                 (local.get $3)
                )
               )
              )
             )
            )
            (call $~lib/as-chain/idxdb/IDXDB#remove@virtual
             (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
              (i32.load offset=4
               (local.get $4)
              )
              (local.get $3)
             )
             (i32.load
              (local.get $10)
             )
            )
           )
           (local.set $3
            (i32.add
             (local.get $3)
             (i32.const 1)
            )
           )
           (br $for-loop|0)
          )
         )
        )
        (if
         (i64.eq
          (local.get $1)
          (i64.sub
           (i64.load offset=8
            (local.get $5)
           )
           (i64.const 1)
          )
         )
         (call $assembly/atomarb.contract/ArbState#set:starting_balance
          (local.get $5)
          (i64.const -1)
         )
        )
       )
      )
      (local.set $3
       (call $assembly/atomarb.contract/TokenMap#constructor
        (local.get $0)
        (local.get $9)
        (local.get $7)
       )
      )
      (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/TokenMap>#store
       (i32.load offset=28
        (local.get $6)
       )
       (local.get $3)
       (i32.load
        (local.get $6)
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const 3626076419565830144)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 32)
         (i32.const 61)
        )
       )
       (i32.const 2448)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo
       (local.get $3)
       (i32.const 2448)
      )
      (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#set:validPrimary
       (local.get $3)
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:rtId
       (local.get $3)
       (i32.const 2448)
      )
      (call $assembly/atomarb.contract/addAmmPoolAction#set:quote_precision
       (local.get $3)
       (i32.const 0)
      )
      (call $assembly/atomarb.contract/Config#set:total_trades
       (local.get $3)
       (i64.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/addAmmPoolAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (local.set $4
       (i32.load
        (local.get $3)
       )
      )
      (local.set $5
       (i32.load offset=4
        (local.get $3)
       )
      )
      (local.set $7
       (i32.load8_u offset=8
        (local.get $3)
       )
      )
      (local.set $9
       (i32.load offset=12
        (local.get $3)
       )
      )
      (local.set $10
       (i32.load8_u offset=16
        (local.get $3)
       )
      )
      (local.set $0
       (i64.load offset=24
        (local.get $3)
       )
      )
      (call $~lib/as-chain/system/check
       (i32.ne
        (local.tee $3
         (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#get
          (i32.load offset=16
           (local.get $6)
          )
         )
        )
        (i32.const 0)
       )
       (i32.const 3296)
      )
      (call $~lib/as-chain/action/requireAuth
       (i32.load
        (local.get $3)
       )
      )
      (local.set $3
       (call $~lib/as-chain/asset/Symbol#constructor
        (local.get $5)
        (local.get $7)
       )
      )
      (local.set $5
       (call $~lib/as-chain/asset/Symbol#constructor
        (local.get $9)
        (local.get $10)
       )
      )
      (local.set $3
       (call $assembly/atomarb.contract/AmmPool#constructor
        (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AmmPool>#get:availablePrimaryKey
         (i32.load offset=32
          (local.get $6)
         )
        )
        (local.get $4)
        (call $~lib/as-chain/asset/Symbol#code
         (local.get $3)
        )
        (call $~lib/as-chain/asset/Symbol#code
         (local.get $5)
        )
        (local.get $0)
       )
      )
      (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AmmPool>#store
       (i32.load offset=32
        (local.get $6)
       )
       (local.get $3)
       (i32.load
        (local.get $6)
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const 3626124985380634624)
     )
     (block
      (call $~lib/as-chain/name/Name#set:N
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 48)
         (i32.const 63)
        )
       )
       (i64.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo2
       (local.get $3)
       (i32.const 2448)
      )
      (call $~lib/rt/common/OBJECT#set:rtId
       (local.get $3)
       (i32.const 2448)
      )
      (call $assembly/atomarb.contract/addAmmPoolAction#set:quote_precision
       (local.get $3)
       (i32.const 0)
      )
      (call $assembly/atomarb.contract/AtomArb#set:authorizedTable
       (local.get $3)
       (i32.const 2448)
      )
      (call $assembly/atomarb.contract/ArbState#set:route
       (local.get $3)
       (i32.const 0)
      )
      (call $assembly/atomarb.contract/ArbState#set:base_symbol
       (local.get $3)
       (i64.const 0)
      )
      (call $assembly/atomarb.contract/ArbState#set:quote_symbol
       (local.get $3)
       (i64.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/addDexMarketAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (local.set $0
       (i64.load
        (local.get $3)
       )
      )
      (local.set $4
       (i32.load offset=8
        (local.get $3)
       )
      )
      (local.set $5
       (i32.load offset=12
        (local.get $3)
       )
      )
      (local.set $7
       (i32.load8_u offset=16
        (local.get $3)
       )
      )
      (local.set $9
       (i32.load offset=20
        (local.get $3)
       )
      )
      (local.set $10
       (i32.load8_u offset=24
        (local.get $3)
       )
      )
      (local.set $1
       (i64.load offset=32
        (local.get $3)
       )
      )
      (local.set $12
       (i64.load offset=40
        (local.get $3)
       )
      )
      (call $~lib/as-chain/system/check
       (i32.ne
        (local.tee $3
         (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#get
          (i32.load offset=16
           (local.get $6)
          )
         )
        )
        (i32.const 0)
       )
       (i32.const 3296)
      )
      (call $~lib/as-chain/action/requireAuth
       (i32.load
        (local.get $3)
       )
      )
      (local.set $3
       (call $~lib/as-chain/asset/Symbol#constructor
        (local.get $5)
        (local.get $7)
       )
      )
      (local.set $5
       (call $~lib/as-chain/asset/Symbol#constructor
        (local.get $9)
        (local.get $10)
       )
      )
      (local.set $3
       (call $assembly/atomarb.contract/DexMarket#constructor
        (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/DexMarket>#get:availablePrimaryKey
         (i32.load offset=36
          (local.get $6)
         )
        )
        (local.get $0)
        (local.get $4)
        (call $~lib/as-chain/asset/Symbol#code
         (local.get $3)
        )
        (call $~lib/as-chain/asset/Symbol#code
         (local.get $5)
        )
        (local.get $1)
        (local.get $12)
       )
      )
      (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/DexMarket>#store
       (i32.load offset=36
        (local.get $6)
       )
       (local.get $3)
       (i32.load
        (local.get $6)
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const -4417316219328135168)
     )
     (block
      (call $~lib/as-chain/name/Name#set:N
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 17)
         (i32.const 65)
        )
       )
       (i64.const 0)
      )
      (call $assembly/atomarb.contract/ArbState#set:starting_balance
       (local.get $3)
       (i64.const 0)
      )
      (call $assembly/atomarb.contract/addAmmPoolAction#set:quote_precision
       (local.get $3)
       (i32.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/setConfigAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (local.set $0
       (i64.load
        (local.get $3)
       )
      )
      (local.set $1
       (i64.load offset=8
        (local.get $3)
       )
      )
      (local.set $4
       (i32.load8_u offset=16
        (local.get $3)
       )
      )
      (call $~lib/as-chain/system/check
       (i32.ne
        (local.tee $3
         (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#get
          (i32.load offset=16
           (local.get $6)
          )
         )
        )
        (i32.const 0)
       )
       (i32.const 3296)
      )
      (call $~lib/as-chain/action/requireAuth
       (i32.load
        (local.get $3)
       )
      )
      (call $assembly/atomarb.contract/ArbState#set:starting_balance
       (local.get $3)
       (local.get $0)
      )
      (call $assembly/atomarb.contract/ArbState#set:min_profit
       (local.get $3)
       (local.get $1)
      )
      (call $assembly/atomarb.contract/Config#set:paused
       (local.get $3)
       (local.get $4)
      )
      (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#set
       (i32.load offset=16
        (local.get $6)
       )
       (local.get $3)
       (i32.load
        (local.get $6)
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const 3626080933230149632)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 4)
         (i32.const 66)
        )
       )
       (i32.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/initAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $3
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (call $~lib/as-chain/system/check
       (i32.ne
        (local.tee $4
         (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#get
          (i32.load offset=16
           (local.get $6)
          )
         )
        )
        (i32.const 0)
       )
       (i32.const 3296)
      )
      (call $~lib/as-chain/action/requireAuth
       (i32.load
        (local.get $4)
       )
      )
      (call $~lib/as-chain/system/check
       (call $~lib/as-chain/action/isAccount
        (local.get $3)
       )
       (i32.const 3568)
      )
      (if
       (i32.eqz
        (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AuthorizedUser>#exists
         (i32.load offset=20
          (local.get $6)
         )
         (i64.load
          (local.get $3)
         )
        )
       )
       (block
        (local.set $3
         (call $assembly/atomarb.contract/AuthorizedUser#constructor
          (local.get $3)
          (i64.extend_i32_u
           (call $~lib/as-chain/system/currentTimeSec)
          )
         )
        )
        (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AuthorizedUser>#store
         (i32.load offset=20
          (local.get $6)
         )
         (local.get $3)
         (i32.load
          (local.get $6)
         )
        )
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const -4860038533768806400)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 4)
         (i32.const 67)
        )
       )
       (i32.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/initAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $4
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (call $~lib/as-chain/system/check
       (i32.ne
        (local.tee $3
         (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#get
          (i32.load offset=16
           (local.get $6)
          )
         )
        )
        (i32.const 0)
       )
       (i32.const 3296)
      )
      (call $~lib/as-chain/action/requireAuth
       (i32.load
        (local.get $3)
       )
      )
      (local.set $3
       (i32.const 0)
      )
      (if
       (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
        (local.tee $4
         (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/AuthorizedUser>#find
          (local.tee $5
           (i32.load
            (i32.load offset=20
             (local.get $6)
            )
           )
          )
          (i64.load
           (local.get $4)
          )
         )
        )
       )
       (block
        (drop
         (i32.load
          (local.get $5)
         )
        )
        (if
         (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
          (local.get $4)
         )
         (if
          (local.tee $4
           (call $~lib/as-chain/env/db_get_i64
            (local.tee $5
             (i32.load offset=4
              (local.get $4)
             )
            )
            (i32.const 0)
            (i32.const 0)
           )
          )
          (block
           (drop
            (call $~lib/as-chain/env/db_get_i64
             (local.get $5)
             (i32.load offset=4
              (local.tee $5
               (call $~lib/array/Array<u8>#constructor
                (local.get $4)
               )
              )
             )
             (local.get $4)
            )
           )
           (global.set $~argumentsLength
            (i32.const 0)
           )
           (drop
            (call $assembly/atomarb.contract/AuthorizedUser#unpack
             (local.tee $3
              (call $assembly/atomarb.contract/AuthorizedUser#constructor@varargs)
             )
             (local.get $5)
            )
           )
          )
         )
        )
       )
      )
      (if
       (local.get $3)
       (block
        (local.set $4
         (i32.load offset=20
          (local.get $6)
         )
        )
        (local.set $0
         (call $assembly/atomarb.contract/AuthorizedUser#getPrimaryValue
          (local.get $3)
         )
        )
        (call $~lib/as-chain/system/check
         (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
          (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/AuthorizedUser>#find
           (i32.load
            (local.get $4)
           )
           (local.get $0)
          )
         )
         (i32.const 1648)
        )
        (local.set $3
         (i32.const 0)
        )
        (call $~lib/as-chain/system/check
         (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
          (local.tee $7
           (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/AuthorizedUser>#find
            (local.tee $5
             (i32.load
              (local.get $4)
             )
            )
            (local.get $0)
           )
          )
         )
         (i32.const 3488)
        )
        (call $~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/TokenMap>#remove
         (i32.load
          (local.get $5)
         )
         (local.get $7)
        )
        (loop $for-loop|00
         (if
          (i32.lt_s
           (local.get $3)
           (i32.load offset=12
            (i32.load offset=4
             (local.get $5)
            )
           )
          )
          (block
           (if
            (call $~lib/as-chain/idxdb/SecondaryIterator#isOk
             (i32.load
              (local.tee $7
               (call $~lib/as-chain/idxdb/IDXDB#findPrimaryEx@virtual
                (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
                 (i32.load offset=4
                  (local.get $5)
                 )
                 (local.get $3)
                )
               )
              )
             )
            )
            (call $~lib/as-chain/idxdb/IDXDB#remove@virtual
             (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
              (i32.load offset=4
               (local.get $5)
              )
              (local.get $3)
             )
             (i32.load
              (local.get $7)
             )
            )
           )
           (local.set $3
            (i32.add
             (local.get $3)
             (i32.const 1)
            )
           )
           (br $for-loop|00)
          )
         )
        )
        (if
         (i64.eq
          (local.get $0)
          (i64.sub
           (i64.load offset=8
            (local.get $4)
           )
           (i64.const 1)
          )
         )
         (call $assembly/atomarb.contract/ArbState#set:starting_balance
          (local.get $4)
          (i64.const -1)
         )
        )
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const -4488220096160197632)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 20)
         (i32.const 68)
        )
       )
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo
       (local.get $3)
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo2
       (local.get $3)
       (i32.const 2448)
      )
      (call $assembly/atomarb.contract/TradeRecord#set:route
       (local.get $3)
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:rtSize
       (local.get $3)
       (i32.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/saveBalanceAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $4
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (local.tee $5
         (i32.load offset=4
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (local.set $7
       (i32.load offset=8
        (local.get $3)
       )
      )
      (local.set $9
       (i32.load8_u offset=12
        (local.get $3)
       )
      )
      (if
       (i32.eqz
        (local.tee $10
         (i32.load offset=16
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (call $~lib/as-chain/action/requireAuth
       (local.get $4)
      )
      (call $~lib/as-chain/system/check
       (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AuthorizedUser>#exists
        (i32.load offset=20
         (local.get $6)
        )
        (i64.load
         (local.get $4)
        )
       )
       (i32.const 3632)
      )
      (call $~lib/as-chain/system/check
       (i32.ne
        (local.tee $3
         (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#get
          (i32.load offset=16
           (local.get $6)
          )
         )
        )
        (i32.const 0)
       )
       (i32.const 3296)
      )
      (call $~lib/as-chain/system/check
       (i32.eqz
        (i32.load8_u offset=4
         (local.get $3)
        )
       )
       (i32.const 3696)
      )
      (local.set $3
       (call $~lib/as-chain/asset/Symbol#constructor
        (local.get $7)
        (local.get $9)
       )
      )
      (if
       (local.tee $7
        (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#get
         (i32.load offset=12
          (local.get $6)
         )
         (i64.load
          (local.get $4)
         )
        )
       )
       (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#remove
        (i32.load offset=12
         (local.get $6)
        )
        (local.get $7)
       )
      )
      (local.set $3
       (call $assembly/atomarb.contract/ArbState#constructor
        (local.get $4)
        (i64.load
         (call $assembly/atomarb.contract/getBalance
          (local.get $5)
          (local.get $4)
          (local.get $3)
         )
        )
        (i64.load
         (local.get $10)
        )
        (i32.const 0)
        (call $~lib/as-chain/asset/Symbol#code
         (local.get $3)
        )
        (i64.const 0)
        (i64.const 0)
        (i64.extend_i32_u
         (call $~lib/as-chain/system/currentTimeSec)
        )
       )
      )
      (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#store
       (i32.load offset=12
        (local.get $6)
       )
       (local.get $3)
       (i32.load
        (local.get $6)
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const 3877341111153328128)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 24)
         (i32.const 76)
        )
       )
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo
       (local.get $3)
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo2
       (local.get $3)
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:rtId
       (local.get $3)
       (i32.const 2448)
      )
      (call $~lib/rt/common/OBJECT#set:rtSize
       (local.get $3)
       (i32.const 0)
      )
      (call $assembly/atomarb.contract/AtomArb#set:authorizedTable
       (local.get $3)
       (i32.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/arbLegOneAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $4
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (i32.load offset=4
         (local.get $3)
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (local.tee $5
         (i32.load offset=8
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (local.set $7
       (i32.load offset=12
        (local.get $3)
       )
      )
      (if
       (i32.eqz
        (local.tee $9
         (i32.load offset=16
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (local.tee $10
         (i32.load offset=20
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (call $~lib/as-chain/action/requireAuth
       (local.get $4)
      )
      (call $~lib/as-chain/system/check
       (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AuthorizedUser>#exists
        (i32.load offset=20
         (local.get $6)
        )
        (i64.load
         (local.get $4)
        )
       )
       (i32.const 3632)
      )
      (call $~lib/as-chain/system/check
       (i32.ne
        (local.tee $3
         (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#get
          (i32.load offset=16
           (local.get $6)
          )
         )
        )
        (i32.const 0)
       )
       (i32.const 3296)
      )
      (call $~lib/as-chain/system/check
       (i32.eqz
        (i32.load8_u offset=4
         (local.get $3)
        )
       )
       (i32.const 3696)
      )
      (local.set $11
       (call $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#constructor)
      )
      (call $~lib/as-chain/name/Name#set:N
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 8)
         (i32.const 5)
        )
       )
       (i64.const 0)
      )
      (call $~lib/as-chain/name/Name#set:N
       (local.get $3)
       (i64.const 3617214756542218240)
      )
      (call $~lib/as-chain/helpers/InlineActionAct<assembly/atomarb.contract/TransferArgs>#send
       (call $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#act
        (local.get $11)
        (local.get $10)
        (call $~lib/as-chain/action/PermissionLevel#constructor
         (local.get $4)
         (local.get $3)
        )
       )
       (call $assembly/atomarb.contract/TransferArgs#constructor
        (local.get $4)
        (local.get $5)
        (local.get $9)
        (local.get $7)
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const 3877341113993920512)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 28)
         (i32.const 84)
        )
       )
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo
       (local.get $3)
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo2
       (local.get $3)
       (i32.const 2448)
      )
      (call $assembly/atomarb.contract/TradeRecord#set:route
       (local.get $3)
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:rtSize
       (local.get $3)
       (i32.const 0)
      )
      (call $assembly/atomarb.contract/AtomArb#set:authorizedTable
       (local.get $3)
       (i32.const 2448)
      )
      (call $assembly/atomarb.contract/AtomArb#set:tradesTable
       (local.get $3)
       (i32.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/arbLegTwoAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $4
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (local.tee $5
         (i32.load offset=4
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (drop
       (i32.load offset=8
        (local.get $3)
       )
      )
      (drop
       (i32.load8_u offset=12
        (local.get $3)
       )
      )
      (if
       (i32.eqz
        (local.tee $7
         (i32.load offset=16
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (local.set $9
       (i32.load offset=20
        (local.get $3)
       )
      )
      (if
       (i32.eqz
        (local.tee $10
         (i32.load offset=24
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (call $~lib/as-chain/action/requireAuth
       (local.get $4)
      )
      (call $~lib/as-chain/system/check
       (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AuthorizedUser>#exists
        (i32.load offset=20
         (local.get $6)
        )
        (i64.load
         (local.get $4)
        )
       )
       (i32.const 3632)
      )
      (local.set $11
       (call $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#constructor)
      )
      (call $~lib/as-chain/name/Name#set:N
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 8)
         (i32.const 5)
        )
       )
       (i64.const 0)
      )
      (call $~lib/as-chain/name/Name#set:N
       (local.get $3)
       (i64.const 3617214756542218240)
      )
      (call $~lib/as-chain/helpers/InlineActionAct<assembly/atomarb.contract/TransferArgs>#send
       (call $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#act
        (local.get $11)
        (local.get $5)
        (call $~lib/as-chain/action/PermissionLevel#constructor
         (local.get $4)
         (local.get $3)
        )
       )
       (call $assembly/atomarb.contract/TransferArgs#constructor
        (local.get $4)
        (local.get $7)
        (local.get $10)
        (local.get $9)
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const 3877341103468838912)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 20)
         (i32.const 85)
        )
       )
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo
       (local.get $3)
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo2
       (local.get $3)
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:rtId
       (local.get $3)
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:rtSize
       (local.get $3)
       (i32.const 2448)
      )
      (drop
       (call $assembly/atomarb.contract/arbLegAddAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $4
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (local.tee $5
         (i32.load offset=4
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (local.tee $7
         (i32.load offset=8
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (local.tee $9
         (i32.load offset=12
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (local.set $10
       (i32.load offset=16
        (local.get $3)
       )
      )
      (call $~lib/as-chain/action/requireAuth
       (local.get $4)
      )
      (call $~lib/as-chain/system/check
       (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AuthorizedUser>#exists
        (i32.load offset=20
         (local.get $6)
        )
        (i64.load
         (local.get $4)
        )
       )
       (i32.const 3632)
      )
      (local.set $11
       (call $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#constructor)
      )
      (call $~lib/as-chain/name/Name#set:N
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 8)
         (i32.const 5)
        )
       )
       (i64.const 0)
      )
      (call $~lib/as-chain/name/Name#set:N
       (local.get $3)
       (i64.const 3617214756542218240)
      )
      (call $~lib/as-chain/helpers/InlineActionAct<assembly/atomarb.contract/TransferArgs>#send
       (call $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#act
        (local.get $11)
        (local.get $5)
        (call $~lib/as-chain/action/PermissionLevel#constructor
         (local.get $4)
         (local.get $3)
        )
       )
       (call $assembly/atomarb.contract/TransferArgs#constructor
        (local.get $4)
        (local.get $9)
        (local.get $7)
        (local.get $10)
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const 3793607746394259456)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 20)
         (i32.const 86)
        )
       )
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo
       (local.get $3)
       (i32.const 0)
      )
      (call $assembly/atomarb.contract/ArbState#set:starting_balance
       (local.get $3)
       (i64.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:rtSize
       (local.get $3)
       (i32.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/ammToDexAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $4
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (local.tee $5
         (i32.load offset=4
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (local.set $0
       (i64.load offset=8
        (local.get $3)
       )
      )
      (if
       (i32.eqz
        (local.tee $3
         (i32.load offset=16
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (call $assembly/atomarb.contract/AtomArb#ammToDex
       (local.get $6)
       (local.get $4)
       (local.get $5)
       (local.get $0)
       (local.get $3)
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const 5385067217287118848)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 16)
         (i32.const 88)
        )
       )
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo
       (local.get $3)
       (i32.const 0)
      )
      (call $assembly/atomarb.contract/ArbState#set:starting_balance
       (local.get $3)
       (i64.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/dexToAmmAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $4
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (local.tee $5
         (i32.load offset=4
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (call $assembly/atomarb.contract/AtomArb#dexToAmm
       (local.get $6)
       (local.get $4)
       (local.get $5)
       (i64.load offset=8
        (local.get $3)
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const -5002754491523006464)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 8)
         (i32.const 89)
        )
       )
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo
       (local.get $3)
       (i32.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/redeemXmdAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $4
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (local.tee $3
         (i32.load offset=4
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (call $~lib/as-chain/action/requireAuth
       (local.get $4)
      )
      (call $~lib/as-chain/system/check
       (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AuthorizedUser>#exists
        (i32.load offset=20
         (local.get $6)
        )
        (i64.load
         (local.get $4)
        )
       )
       (i32.const 3632)
      )
      (call $~lib/as-chain/system/check
       (i64.eq
        (call $~lib/as-chain/asset/Symbol#code
         (i32.load offset=8
          (local.get $3)
         )
        )
        (call $~lib/as-chain/asset/Symbol#code
         (call $~lib/as-chain/asset/Symbol#constructor
          (i32.const 4576)
          (i32.const 6)
         )
        )
       )
       (i32.const 4880)
      )
      (call $~lib/as-chain/system/check
       (i64.gt_s
        (i64.load
         (local.get $3)
        )
        (i64.const 0)
       )
       (i32.const 4192)
      )
      (local.set $9
       (call $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#constructor)
      )
      (call $~lib/as-chain/name/Name#set:N
       (local.tee $5
        (call $~lib/rt/stub/__new
         (i32.const 8)
         (i32.const 5)
        )
       )
       (i64.const 0)
      )
      (call $~lib/as-chain/name/Name#set:N
       (local.get $5)
       (i64.const -1400042437898403840)
      )
      (call $~lib/as-chain/name/Name#set:N
       (local.tee $7
        (call $~lib/rt/stub/__new
         (i32.const 8)
         (i32.const 5)
        )
       )
       (i64.const 0)
      )
      (call $~lib/as-chain/name/Name#set:N
       (local.get $7)
       (i64.const 3617214756542218240)
      )
      (call $~lib/as-chain/helpers/InlineActionAct<assembly/atomarb.contract/TransferArgs>#send
       (call $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#act
        (local.get $9)
        (local.get $5)
        (call $~lib/as-chain/action/PermissionLevel#constructor
         (local.get $4)
         (local.get $7)
        )
       )
       (call $assembly/atomarb.contract/TransferArgs#constructor
        (local.get $4)
        (global.get $assembly/atomarb.contract/TREASURY_CONTRACT)
        (local.get $3)
        (i32.const 4928)
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const -4103519408490545152)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 12)
         (i32.const 90)
        )
       )
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo
       (local.get $3)
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo2
       (local.get $3)
       (i32.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/swapXprAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $4
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (local.tee $5
         (i32.load offset=4
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (local.tee $3
         (i32.load offset=8
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (call $~lib/as-chain/action/requireAuth
       (local.get $4)
      )
      (call $~lib/as-chain/system/check
       (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AuthorizedUser>#exists
        (i32.load offset=20
         (local.get $6)
        )
        (i64.load
         (local.get $4)
        )
       )
       (i32.const 3632)
      )
      (call $~lib/as-chain/system/check
       (i64.eq
        (call $~lib/as-chain/asset/Symbol#code
         (i32.load offset=8
          (local.get $5)
         )
        )
        (call $~lib/as-chain/asset/Symbol#code
         (call $~lib/as-chain/asset/Symbol#constructor
          (i32.const 4272)
          (i32.const 4)
         )
        )
       )
       (i32.const 4976)
      )
      (call $~lib/as-chain/system/check
       (i64.gt_s
        (i64.load
         (local.get $5)
        )
        (i64.const 0)
       )
       (i32.const 4192)
      )
      (call $~lib/as-chain/system/check
       (i64.eq
        (call $~lib/as-chain/asset/Symbol#code
         (i32.load offset=8
          (local.get $3)
         )
        )
        (call $~lib/as-chain/asset/Symbol#code
         (call $~lib/as-chain/asset/Symbol#constructor
          (i32.const 4080)
          (i32.const 6)
         )
        )
       )
       (i32.const 5024)
      )
      (local.set $9
       (call $~lib/string/String.__concat
        (i32.const 4608)
        (call $~lib/as-chain/asset/Asset#toString
         (local.get $3)
        )
       )
      )
      (local.set $10
       (call $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#constructor)
      )
      (call $~lib/as-chain/name/Name#set:N
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 8)
         (i32.const 5)
        )
       )
       (i64.const 0)
      )
      (call $~lib/as-chain/name/Name#set:N
       (local.get $3)
       (i64.const 6138663591592764928)
      )
      (call $~lib/as-chain/name/Name#set:N
       (local.tee $7
        (call $~lib/rt/stub/__new
         (i32.const 8)
         (i32.const 5)
        )
       )
       (i64.const 0)
      )
      (call $~lib/as-chain/name/Name#set:N
       (local.get $7)
       (i64.const 3617214756542218240)
      )
      (call $~lib/as-chain/helpers/InlineActionAct<assembly/atomarb.contract/TransferArgs>#send
       (call $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#act
        (local.get $10)
        (local.get $3)
        (call $~lib/as-chain/action/PermissionLevel#constructor
         (local.get $4)
         (local.get $7)
        )
       )
       (call $assembly/atomarb.contract/TransferArgs#constructor
        (local.get $4)
        (global.get $assembly/atomarb.contract/AMM_CONTRACT)
        (local.get $5)
        (local.get $9)
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const 5384780503632461824)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 12)
         (i32.const 91)
        )
       )
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo
       (local.get $3)
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo2
       (local.get $3)
       (i32.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/dexDepositAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $4
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (local.tee $5
         (i32.load offset=4
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (local.tee $7
         (i32.load offset=8
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (call $~lib/as-chain/action/requireAuth
       (local.get $4)
      )
      (call $~lib/as-chain/system/check
       (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/AuthorizedUser>#exists
        (i32.load offset=20
         (local.get $6)
        )
        (i64.load
         (local.get $4)
        )
       )
       (i32.const 3632)
      )
      (local.set $9
       (call $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#constructor)
      )
      (call $~lib/as-chain/name/Name#set:N
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 8)
         (i32.const 5)
        )
       )
       (i64.const 0)
      )
      (call $~lib/as-chain/name/Name#set:N
       (local.get $3)
       (i64.const 3617214756542218240)
      )
      (call $~lib/as-chain/helpers/InlineActionAct<assembly/atomarb.contract/TransferArgs>#send
       (call $~lib/as-chain/helpers/InlineAction<assembly/atomarb.contract/TransferArgs>#act
        (local.get $9)
        (local.get $5)
        (call $~lib/as-chain/action/PermissionLevel#constructor
         (local.get $4)
         (local.get $3)
        )
       )
       (call $assembly/atomarb.contract/TransferArgs#constructor
        (local.get $4)
        (global.get $assembly/atomarb.contract/DEX_CONTRACT)
        (local.get $7)
        (i32.const 5104)
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const 5384980952952864768)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 53)
         (i32.const 92)
        )
       )
       (i32.const 0)
      )
      (call $assembly/atomarb.contract/ArbState#set:starting_balance
       (local.get $3)
       (i64.const 0)
      )
      (call $assembly/atomarb.contract/addAmmPoolAction#set:quote_precision
       (local.get $3)
       (i32.const 0)
      )
      (call $assembly/atomarb.contract/dexOrderAction#set:order_type
       (local.get $3)
       (i32.const 0)
      )
      (call $assembly/atomarb.contract/Config#set:total_trades
       (local.get $3)
       (i64.const 0)
      )
      (call $assembly/atomarb.contract/ArbState#set:base_symbol
       (local.get $3)
       (i64.const 0)
      )
      (call $assembly/atomarb.contract/AtomArb#set:legBalanceTable
       (local.get $3)
       (i32.const 2448)
      )
      (call $assembly/atomarb.contract/dexOrderAction#set:bid_precision
       (local.get $3)
       (i32.const 0)
      )
      (call $assembly/atomarb.contract/dexOrderAction#set:ask_symbol_str
       (local.get $3)
       (i32.const 2448)
      )
      (call $assembly/atomarb.contract/dexOrderAction#set:ask_precision
       (local.get $3)
       (i32.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/dexOrderAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $4
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (call $assembly/atomarb.contract/AtomArb#dexOrder
       (local.get $6)
       (local.get $4)
       (i64.load offset=8
        (local.get $3)
       )
       (i32.load8_u offset=16
        (local.get $3)
       )
       (i32.load8_u offset=17
        (local.get $3)
       )
       (i64.load offset=24
        (local.get $3)
       )
       (i64.load offset=32
        (local.get $3)
       )
       (i32.load offset=40
        (local.get $3)
       )
       (i32.load8_u offset=44
        (local.get $3)
       )
       (i32.load offset=48
        (local.get $3)
       )
       (i32.load8_u offset=52
        (local.get $3)
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const 5385117018904705024)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 8)
         (i32.const 96)
        )
       )
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo
       (local.get $3)
       (i32.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/redeemXmdAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $4
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (local.tee $3
         (i32.load offset=4
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (call $assembly/atomarb.contract/AtomArb#dexWithdraw
       (local.get $6)
       (local.get $4)
       (local.get $3)
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const 4851652355937497600)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 20)
         (i32.const 100)
        )
       )
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo
       (local.get $3)
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:gcInfo2
       (local.get $3)
       (i32.const 2448)
      )
      (call $assembly/atomarb.contract/TradeRecord#set:route
       (local.get $3)
       (i32.const 0)
      )
      (call $~lib/rt/common/OBJECT#set:rtSize
       (local.get $3)
       (i32.const 2448)
      )
      (drop
       (call $assembly/atomarb.contract/checkBalExtAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $4
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (i32.eqz
        (local.tee $5
         (i32.load offset=4
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (call $assembly/atomarb.contract/AtomArb#checkBalExt
       (local.get $6)
       (local.get $4)
       (local.get $5)
       (i32.load offset=8
        (local.get $3)
       )
       (i32.load8_u offset=12
        (local.get $3)
       )
       (i32.load offset=16
        (local.get $3)
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const -2688959074178957312)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 16)
         (i32.const 102)
        )
       )
       (i32.const 0)
      )
      (call $assembly/atomarb.contract/ArbState#set:starting_balance
       (local.get $3)
       (i64.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/AuthorizedUser#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $4
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (call $assembly/atomarb.contract/AtomArb#verify
       (local.get $6)
       (local.get $4)
       (i64.load offset=8
        (local.get $3)
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const 4730614985703555072)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 4)
         (i32.const 103)
        )
       )
       (i32.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/initAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $4
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (call $~lib/as-chain/action/requireAuth
       (local.get $4)
      )
      (if
       (local.tee $3
        (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#get
         (i32.load offset=12
          (local.get $6)
         )
         (i64.load
          (local.get $4)
         )
        )
       )
       (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#remove
        (i32.load offset=12
         (local.get $6)
        )
        (local.get $3)
       )
      )
      (local.set $3
       (i32.const 0)
      )
      (if
       (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
        (local.tee $4
         (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/LegBalance>#find
          (local.tee $5
           (i32.load
            (i32.load offset=40
             (local.get $6)
            )
           )
          )
          (i64.load
           (local.get $4)
          )
         )
        )
       )
       (block
        (drop
         (i32.load
          (local.get $5)
         )
        )
        (if
         (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
          (local.get $4)
         )
         (if
          (local.tee $4
           (call $~lib/as-chain/env/db_get_i64
            (local.tee $5
             (i32.load offset=4
              (local.get $4)
             )
            )
            (i32.const 0)
            (i32.const 0)
           )
          )
          (block
           (drop
            (call $~lib/as-chain/env/db_get_i64
             (local.get $5)
             (i32.load offset=4
              (local.tee $5
               (call $~lib/array/Array<u8>#constructor
                (local.get $4)
               )
              )
             )
             (local.get $4)
            )
           )
           (global.set $~argumentsLength
            (i32.const 0)
           )
           (drop
            (call $assembly/atomarb.contract/LegBalance#unpack
             (local.tee $3
              (call $assembly/atomarb.contract/LegBalance#constructor@varargs)
             )
             (local.get $5)
            )
           )
          )
         )
        )
       )
      )
      (if
       (local.get $3)
       (block
        (local.set $4
         (i32.load offset=40
          (local.get $6)
         )
        )
        (local.set $0
         (call $assembly/atomarb.contract/AuthorizedUser#getPrimaryValue
          (local.get $3)
         )
        )
        (call $~lib/as-chain/system/check
         (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
          (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/LegBalance>#find
           (i32.load
            (local.get $4)
           )
           (local.get $0)
          )
         )
         (i32.const 1648)
        )
        (local.set $3
         (i32.const 0)
        )
        (call $~lib/as-chain/system/check
         (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
          (local.tee $7
           (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/LegBalance>#find
            (local.tee $5
             (i32.load
              (local.get $4)
             )
            )
            (local.get $0)
           )
          )
         )
         (i32.const 3488)
        )
        (call $~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/TokenMap>#remove
         (i32.load
          (local.get $5)
         )
         (local.get $7)
        )
        (loop $for-loop|001
         (if
          (i32.lt_s
           (local.get $3)
           (i32.load offset=12
            (i32.load offset=4
             (local.get $5)
            )
           )
          )
          (block
           (if
            (call $~lib/as-chain/idxdb/SecondaryIterator#isOk
             (i32.load
              (local.tee $7
               (call $~lib/as-chain/idxdb/IDXDB#findPrimaryEx@virtual
                (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
                 (i32.load offset=4
                  (local.get $5)
                 )
                 (local.get $3)
                )
               )
              )
             )
            )
            (call $~lib/as-chain/idxdb/IDXDB#remove@virtual
             (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
              (i32.load offset=4
               (local.get $5)
              )
              (local.get $3)
             )
             (i32.load
              (local.get $7)
             )
            )
           )
           (local.set $3
            (i32.add
             (local.get $3)
             (i32.const 1)
            )
           )
           (br $for-loop|001)
          )
         )
        )
        (if
         (i64.eq
          (local.get $0)
          (i64.sub
           (i64.load offset=8
            (local.get $4)
           )
           (i64.const 1)
          )
         )
         (call $assembly/atomarb.contract/ArbState#set:starting_balance
          (local.get $4)
          (i64.const -1)
         )
        )
       )
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const 4923678490122780672)
     )
     (block
      (drop
       (call $assembly/atomarb.contract/clearAction#unpack
        (call $~lib/rt/stub/__new
         (i32.const 0)
         (i32.const 105)
        )
        (local.get $8)
       )
      )
      (call $~lib/as-chain/system/check
       (i32.ne
        (local.tee $3
         (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#get
          (i32.load offset=16
           (local.get $6)
          )
         )
        )
        (i32.const 0)
       )
       (i32.const 3296)
      )
      (call $~lib/as-chain/action/requireAuth
       (i32.load
        (local.get $3)
       )
      )
      (call $~lib/as-chain/debug/print
       (i32.const 5696)
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const -4994302320998088704)
     )
     (block
      (drop
       (call $assembly/atomarb.contract/clearAction#unpack
        (call $~lib/rt/stub/__new
         (i32.const 0)
         (i32.const 106)
        )
        (local.get $8)
       )
      )
      (call $~lib/as-chain/action/requireAuth
       (i32.load
        (local.get $6)
       )
      )
      (if
       (call $~lib/proton-tsc/modules/store/singleton/Singleton<assembly/atomarb.contract/Config>#get
        (i32.load offset=16
         (local.get $6)
        )
       )
       (if
        (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
         (local.tee $5
          (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/Config>#find
           (i32.load offset=8
            (local.tee $3
             (i32.load offset=16
              (local.get $6)
             )
            )
           )
           (i64.load
            (local.get $3)
           )
          )
         )
        )
        (block
         (if
          (i32.eqz
           (block $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/Config>#get (result i32)
            (local.set $7
             (i32.load
              (local.tee $4
               (i32.load offset=8
                (local.get $3)
               )
              )
             )
            )
            (drop
             (br_if $__inlined_func$~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/Config>#get
              (i32.const 0)
              (i32.eqz
               (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
                (local.get $5)
               )
              )
             )
            )
            (call $~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/Config>#getEx
             (local.get $7)
             (i32.load offset=4
              (local.get $5)
             )
            )
           )
          )
          (block
           (global.set $~argumentsLength
            (i32.const 0)
           )
           (drop
            (call $assembly/atomarb.contract/Config#constructor@varargs)
           )
          )
         )
         (local.set $5
          (i32.const 0)
         )
         (call $~lib/as-chain/system/check
          (call $~lib/as-chain/dbi64/PrimaryIterator<assembly/atomarb.contract/Config>#isOk
           (local.tee $3
            (call $~lib/as-chain/mi/MultiIndex<assembly/atomarb.contract/Config>#find
             (local.get $4)
             (call $assembly/atomarb.contract/Config#getPrimaryValue)
            )
           )
          )
          (i32.const 3488)
         )
         (call $~lib/as-chain/dbi64/DBI64<assembly/atomarb.contract/TokenMap>#remove
          (i32.load
           (local.get $4)
          )
          (local.get $3)
         )
         (loop $for-loop|01
          (if
           (i32.lt_s
            (local.get $5)
            (i32.load offset=12
             (i32.load offset=4
              (local.get $4)
             )
            )
           )
           (block
            (if
             (call $~lib/as-chain/idxdb/SecondaryIterator#isOk
              (i32.load
               (local.tee $3
                (call $~lib/as-chain/idxdb/IDXDB#findPrimaryEx@virtual
                 (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
                  (i32.load offset=4
                   (local.get $4)
                  )
                  (local.get $5)
                 )
                )
               )
              )
             )
             (call $~lib/as-chain/idxdb/IDXDB#remove@virtual
              (call $~lib/array/Array<~lib/as-chain/idxdb/IDXDB>#__get
               (i32.load offset=4
                (local.get $4)
               )
               (local.get $5)
              )
              (i32.load
               (local.get $3)
              )
             )
            )
            (local.set $5
             (i32.add
              (local.get $5)
              (i32.const 1)
             )
            )
            (br $for-loop|01)
           )
          )
         )
        )
       )
      )
      (call $~lib/as-chain/debug/print
       (i32.const 5824)
      )
     )
    )
    (if
     (i64.eq
      (local.get $2)
      (i64.const 4851652658018811904)
     )
     (block
      (call $~lib/rt/common/BLOCK#set:mmInfo
       (local.tee $3
        (call $~lib/rt/stub/__new
         (i32.const 4)
         (i32.const 107)
        )
       )
       (i32.const 0)
      )
      (drop
       (call $assembly/atomarb.contract/initAction#unpack
        (local.get $3)
        (local.get $8)
       )
      )
      (if
       (i32.eqz
        (local.tee $3
         (i32.load
          (local.get $3)
         )
        )
       )
       (unreachable)
      )
      (if
       (local.tee $3
        (call $~lib/proton-tsc/modules/store/store/TableStore<assembly/atomarb.contract/ArbState>#get
         (i32.load offset=12
          (local.get $6)
         )
         (i64.load
          (local.get $3)
         )
        )
       )
       (block
        (call $~lib/as-chain/debug/print
         (call $~lib/string/String.__concat
          (i32.const 5920)
          (call $~lib/as-chain/name/N2S
           (i64.load
            (i32.load
             (local.get $3)
            )
           )
          )
         )
        )
        (call $~lib/as-chain/debug/print
         (call $~lib/string/String.__concat
          (i32.const 5952)
          (call $~lib/number/U64#toString
           (i64.load offset=8
            (local.get $3)
           )
          )
         )
        )
        (call $~lib/as-chain/debug/print
         (call $~lib/string/String.__concat
          (i32.const 6000)
          (call $~lib/number/U64#toString
           (i64.load offset=16
            (local.get $3)
           )
          )
         )
        )
        (block $__inlined_func$~lib/util/number/utoa32
         (if
          (i32.eqz
           (local.tee $3
            (i32.load8_u offset=24
             (local.get $3)
            )
           )
          )
          (block
           (local.set $6
            (i32.const 4656)
           )
           (br $__inlined_func$~lib/util/number/utoa32)
          )
         )
         (call $~lib/util/number/utoa_dec_simple<u32>
          (local.tee $6
           (call $~lib/rt/stub/__new
            (i32.shl
             (local.tee $8
              (call $~lib/util/number/decimalCount32
               (local.get $3)
              )
             )
             (i32.const 1)
            )
            (i32.const 1)
           )
          )
          (local.get $3)
          (local.get $8)
         )
        )
        (call $~lib/as-chain/debug/print
         (call $~lib/string/String.__concat
          (i32.const 6048)
          (local.get $6)
         )
        )
       )
       (call $~lib/as-chain/debug/print
        (i32.const 6096)
       )
      )
     )
    )
   )
  )
 )
 (func $assembly/atomarb.contract/PlaceOrderArgs#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#constructor
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/ArbState#set:starting_balance
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/addAmmPoolAction#set:quote_precision
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/dexOrderAction#set:order_type
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/Config#set:total_trades
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/ArbState#set:base_symbol
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.tee $2
    (call $~lib/as-chain/asset/Symbol#constructor
     (i32.const 2448)
     (i32.const 0)
    )
   )
  )
  (call $assembly/atomarb.contract/AtomArb#set:legBalanceTable
   (local.get $0)
   (local.get $2)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.tee $2
    (call $~lib/as-chain/asset/Symbol#constructor
     (i32.const 2448)
     (i32.const 0)
    )
   )
  )
  (call $assembly/atomarb.contract/PlaceOrderArgs#set:ask_symbol
   (local.get $0)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/ArbState#set:intermediate_symbol
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $1)
   )
  )
  (call $assembly/atomarb.contract/DexMarket#set:enabled
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<bool>
    (local.get $1)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $2
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $2)
   (i64.const 0)
  )
  (call $~lib/as-chain/serializer/Decoder#unpack
   (local.get $1)
   (local.get $2)
  )
  (call $assembly/atomarb.contract/PlaceOrderArgs#set:referrer
   (local.get $0)
   (local.get $2)
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $~lib/as-chain/serializer/Decoder#unpackName (param $0 i32) (result i32)
  (local $1 i64)
  (local.set $1
   (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
    (local.get $0)
   )
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (local.get $1)
  )
  (local.get $0)
 )
 (func $~lib/as-chain/action/Action#unpack (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackName
    (local.tee $2
     (call $~lib/as-chain/serializer/Decoder#constructor
      (local.get $1)
     )
    )
   )
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $0)
   (call $~lib/as-chain/serializer/Decoder#unpackName
    (local.get $2)
   )
  )
  (local.set $4
   (local.tee $7
    (call $~lib/as-chain/serializer/Decoder#unpackLength
     (local.get $2)
    )
   )
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.tee $5
    (call $~lib/rt/stub/__new
     (i32.const 16)
     (i32.const 82)
    )
   )
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $5)
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $5)
   (i32.const 0)
  )
  (call $~lib/rt/common/OBJECT#set:rtId
   (local.get $5)
   (i32.const 0)
  )
  (if
   (i32.gt_u
    (local.get $4)
    (i32.const 268435455)
   )
   (unreachable)
  )
  (call $~lib/memory/memory.fill
   (local.tee $1
    (call $~lib/rt/stub/__new
     (local.tee $6
      (i32.shl
       (select
        (local.get $4)
        (i32.const 8)
        (i32.gt_u
         (local.get $4)
         (i32.const 8)
        )
       )
       (i32.const 2)
      )
     )
     (i32.const 0)
    )
   )
   (local.get $6)
  )
  (call $~lib/rt/common/BLOCK#set:mmInfo
   (local.get $5)
   (local.get $1)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo
   (local.get $5)
   (local.get $1)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $5)
   (local.get $6)
  )
  (call $~lib/rt/common/OBJECT#set:rtId
   (local.get $5)
   (local.get $4)
  )
  (call $~lib/rt/common/OBJECT#set:gcInfo2
   (local.get $0)
   (local.get $5)
  )
  (loop $for-loop|0
   (if
    (i32.lt_s
     (local.get $3)
     (local.get $7)
    )
    (block
     (local.set $6
      (call $~lib/as-chain/action/PermissionLevel#constructor
       (call $~lib/as-chain/serializer/Decoder#unpackName
        (local.get $2)
       )
       (call $~lib/as-chain/serializer/Decoder#unpackName
        (local.get $2)
       )
      )
     )
     (if
      (i32.ge_u
       (local.get $3)
       (i32.load offset=12
        (local.tee $4
         (i32.load offset=8
          (local.get $0)
         )
        )
       )
      )
      (block
       (if
        (i32.lt_s
         (local.get $3)
         (i32.const 0)
        )
        (unreachable)
       )
       (call $~lib/array/ensureCapacity
        (local.get $4)
        (local.tee $1
         (i32.add
          (local.get $3)
          (i32.const 1)
         )
        )
        (i32.const 2)
       )
       (call $~lib/rt/common/OBJECT#set:rtId
        (local.get $4)
        (local.get $1)
       )
      )
     )
     (call $~lib/array/Array<~lib/as-chain/action/PermissionLevel>#__uset
      (local.get $4)
      (local.get $3)
      (local.get $6)
     )
     (local.set $3
      (i32.add
       (local.get $3)
       (i32.const 1)
      )
     )
     (br $for-loop|0)
    )
   )
  )
  (drop
   (i32.load offset=4
    (local.get $2)
   )
  )
  (drop
   (call $~lib/as-chain/env/memcpy
    (i32.load offset=4
     (local.tee $1
      (call $~lib/array/Array<u8>#constructor
       (local.tee $3
        (call $~lib/as-chain/serializer/Decoder#unpackLength
         (local.get $2)
        )
       )
      )
     )
    )
    (i32.add
     (i32.load offset=4
      (i32.load
       (local.get $2)
      )
     )
     (i32.load offset=4
      (local.get $2)
     )
    )
    (local.get $3)
   )
  )
  (call $~lib/as-chain/serializer/Decoder#incPos
   (local.get $2)
   (local.get $3)
  )
  (call $~lib/rt/common/OBJECT#set:rtId
   (local.get $0)
   (local.get $1)
  )
  (i32.load offset=4
   (local.get $2)
  )
 )
 (func $~lib/as-chain/asset/Symbol#isValid (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i64)
  (block $__inlined_func$~lib/as-chain/asset/isValid (result i32)
   (drop
    (br_if $__inlined_func$~lib/as-chain/asset/isValid
     (i32.const 0)
     (i64.eqz
      (local.tee $3
       (call $~lib/as-chain/asset/Symbol#code
        (local.get $0)
       )
      )
     )
    )
   )
   (drop
    (br_if $__inlined_func$~lib/as-chain/asset/isValid
     (i32.const 0)
     (i64.ne
      (i64.and
       (local.get $3)
       (i64.const -72057594037927936)
      )
      (i64.const 0)
     )
    )
   )
   (loop $for-loop|0
    (if
     (i32.le_s
      (local.get $2)
      (i32.const 6)
     )
     (block $for-break0
      (local.set $1
       (local.get $2)
      )
      (drop
       (br_if $__inlined_func$~lib/as-chain/asset/isValid
        (i32.const 0)
        (i32.eqz
         (select
          (i32.le_u
           (local.tee $0
            (i32.wrap_i64
             (i64.and
              (local.get $3)
              (i64.const 255)
             )
            )
           )
           (i32.const 90)
          )
          (i32.const 0)
          (i32.ge_u
           (local.get $0)
           (i32.const 65)
          )
         )
        )
       )
      )
      (br_if $for-break0
       (i64.eqz
        (i64.and
         (local.tee $3
          (i64.shr_u
           (local.get $3)
           (i64.const 8)
          )
         )
         (i64.const 255)
        )
       )
      )
      (local.set $2
       (i32.add
        (local.get $1)
        (i32.const 1)
       )
      )
      (br $for-loop|0)
     )
    )
   )
   (local.set $1
    (i32.add
     (local.get $1)
     (i32.const 1)
    )
   )
   (loop $for-loop|1
    (if
     (i32.le_s
      (local.get $1)
      (i32.const 6)
     )
     (block
      (drop
       (br_if $__inlined_func$~lib/as-chain/asset/isValid
        (i32.const 0)
        (i64.ne
         (i64.and
          (local.tee $3
           (i64.shr_u
            (local.get $3)
            (i64.const 8)
           )
          )
          (i64.const 255)
         )
         (i64.const 0)
        )
       )
      )
      (local.set $1
       (i32.add
        (local.get $1)
        (i32.const 1)
       )
      )
      (br $for-loop|1)
     )
    )
   )
   (i32.const 1)
  )
 )
 (func $~lib/as-chain/serializer/Packer#unpack@virtual (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (block $folding-inner4
   (block $folding-inner3
    (block $folding-inner2
     (block $folding-inner1
      (block $folding-inner0
       (block $default
        (block $case42
         (block $case41
          (block $case40
           (block $case39
            (block $case38
             (block $case37
              (block $case36
               (block $case30
                (block $case28
                 (block $case27
                  (block $case26
                   (block $case24
                    (block $case23
                     (block $case22
                      (block $case21
                       (block $case20
                        (block $case19
                         (block $case16
                          (block $case15
                           (block $case14
                            (block $case13
                             (block $case11
                              (block $case10
                               (block $case8
                                (block $case7
                                 (block $case6
                                  (block $case5
                                   (block $case4
                                    (block $case2
                                     (block $case1
                                      (block $case0
                                       (br_table $case40 $default $default $default $case7 $default $default $default $default $default $default $default $case8 $default $default $default $folding-inner1 $default $default $default $case10 $default $default $default $case4 $default $default $default $case5 $default $default $default $case6 $default $default $default $case11 $default $default $default $default $folding-inner2 $default $default $default $default $default $default $default $default $case37 $case36 $default $default $case13 $case41 $case14 $default $case15 $default $case16 $folding-inner2 $folding-inner2 $case19 $case42 $default $case0 $default $default $default $default $case20 $case1 $default $case38 $default $default $default $case39 $case21 $case22 $case23 $default $case24 $folding-inner0 $case26 $case27 $case28 $case2 $default $default $folding-inner0 $folding-inner0 $default $default $case30 $default $folding-inner1 $folding-inner2 $default $folding-inner3 $folding-inner3 $folding-inner2 $default
                                        (i32.sub
                                         (i32.load
                                          (i32.sub
                                           (local.get $0)
                                           (i32.const 8)
                                          )
                                         )
                                         (i32.const 5)
                                        )
                                       )
                                      )
                                      (return
                                       (call $assembly/atomarb.contract/ExtTokenAccount#unpack
                                        (local.get $0)
                                        (local.get $1)
                                       )
                                      )
                                     )
                                     (local.set $1
                                      (call $~lib/as-chain/serializer/Decoder#constructor
                                       (local.get $1)
                                      )
                                     )
                                     (call $~lib/as-chain/name/Name#set:N
                                      (local.tee $2
                                       (call $~lib/rt/stub/__new
                                        (i32.const 8)
                                        (i32.const 5)
                                       )
                                      )
                                      (i64.const 0)
                                     )
                                     (call $~lib/as-chain/name/Name#set:N
                                      (local.get $2)
                                      (i64.const 0)
                                     )
                                     (call $~lib/as-chain/serializer/Decoder#unpack
                                      (local.get $1)
                                      (local.get $2)
                                     )
                                     (call $~lib/rt/common/BLOCK#set:mmInfo
                                      (local.get $0)
                                      (local.get $2)
                                     )
                                     (call $~lib/as-chain/name/Name#set:N
                                      (local.tee $2
                                       (call $~lib/rt/stub/__new
                                        (i32.const 8)
                                        (i32.const 5)
                                       )
                                      )
                                      (i64.const 0)
                                     )
                                     (call $~lib/as-chain/name/Name#set:N
                                      (local.get $2)
                                      (i64.const 0)
                                     )
                                     (call $~lib/as-chain/serializer/Decoder#unpack
                                      (local.get $1)
                                      (local.get $2)
                                     )
                                     (call $~lib/rt/common/OBJECT#set:gcInfo
                                      (local.get $0)
                                      (local.get $2)
                                     )
                                     (global.set $~argumentsLength
                                      (i32.const 0)
                                     )
                                     (call $~lib/as-chain/serializer/Decoder#unpack
                                      (local.get $1)
                                      (local.tee $2
                                       (call $~lib/as-chain/asset/Asset#constructor@varargs)
                                      )
                                     )
                                     (call $~lib/rt/common/OBJECT#set:gcInfo2
                                      (local.get $0)
                                      (local.get $2)
                                     )
                                     (call $~lib/rt/common/OBJECT#set:rtId
                                      (local.get $0)
                                      (call $~lib/as-chain/serializer/Decoder#unpackString
                                       (local.get $1)
                                      )
                                     )
                                     (br $folding-inner4)
                                    )
                                    (return
                                     (call $assembly/atomarb.contract/PlaceOrderArgs#unpack
                                      (local.get $0)
                                      (local.get $1)
                                     )
                                    )
                                   )
                                   (return
                                    (call $assembly/atomarb.contract/TokenMap#unpack
                                     (local.get $0)
                                     (local.get $1)
                                    )
                                   )
                                  )
                                  (return
                                   (call $assembly/atomarb.contract/AmmPool#unpack
                                    (local.get $0)
                                    (local.get $1)
                                   )
                                  )
                                 )
                                 (return
                                  (call $assembly/atomarb.contract/DexMarket#unpack
                                   (local.get $0)
                                   (local.get $1)
                                  )
                                 )
                                )
                                (return
                                 (call $assembly/atomarb.contract/ArbState#unpack
                                  (local.get $0)
                                  (local.get $1)
                                 )
                                )
                               )
                               (return
                                (call $assembly/atomarb.contract/Config#unpack
                                 (local.get $0)
                                 (local.get $1)
                                )
                               )
                              )
                              (return
                               (call $assembly/atomarb.contract/TradeRecord#unpack
                                (local.get $0)
                                (local.get $1)
                               )
                              )
                             )
                             (return
                              (call $assembly/atomarb.contract/LegBalance#unpack
                               (local.get $0)
                               (local.get $1)
                              )
                             )
                            )
                            (return
                             (call $assembly/atomarb.contract/addTokenAction#unpack
                              (local.get $0)
                              (local.get $1)
                             )
                            )
                           )
                           (return
                            (call $assembly/atomarb.contract/addAmmPoolAction#unpack
                             (local.get $0)
                             (local.get $1)
                            )
                           )
                          )
                          (return
                           (call $assembly/atomarb.contract/addDexMarketAction#unpack
                            (local.get $0)
                            (local.get $1)
                           )
                          )
                         )
                         (return
                          (call $assembly/atomarb.contract/setConfigAction#unpack
                           (local.get $0)
                           (local.get $1)
                          )
                         )
                        )
                        (return
                         (call $assembly/atomarb.contract/saveBalanceAction#unpack
                          (local.get $0)
                          (local.get $1)
                         )
                        )
                       )
                       (return
                        (call $assembly/atomarb.contract/arbLegOneAction#unpack
                         (local.get $0)
                         (local.get $1)
                        )
                       )
                      )
                      (return
                       (call $assembly/atomarb.contract/arbLegTwoAction#unpack
                        (local.get $0)
                        (local.get $1)
                       )
                      )
                     )
                     (return
                      (call $assembly/atomarb.contract/arbLegAddAction#unpack
                       (local.get $0)
                       (local.get $1)
                      )
                     )
                    )
                    (return
                     (call $assembly/atomarb.contract/ammToDexAction#unpack
                      (local.get $0)
                      (local.get $1)
                     )
                    )
                   )
                   (return
                    (call $assembly/atomarb.contract/dexToAmmAction#unpack
                     (local.get $0)
                     (local.get $1)
                    )
                   )
                  )
                  (return
                   (call $assembly/atomarb.contract/swapXprAction#unpack
                    (local.get $0)
                    (local.get $1)
                   )
                  )
                 )
                 (return
                  (call $assembly/atomarb.contract/dexDepositAction#unpack
                   (local.get $0)
                   (local.get $1)
                  )
                 )
                )
                (return
                 (call $assembly/atomarb.contract/dexOrderAction#unpack
                  (local.get $0)
                  (local.get $1)
                 )
                )
               )
               (return
                (call $assembly/atomarb.contract/checkBalExtAction#unpack
                 (local.get $0)
                 (local.get $1)
                )
               )
              )
              (call $~lib/as-chain/name/Name#set:N
               (local.get $0)
               (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
                (local.tee $0
                 (call $~lib/as-chain/serializer/Decoder#constructor
                  (local.get $1)
                 )
                )
               )
              )
              (return
               (i32.load offset=4
                (local.get $0)
               )
              )
             )
             (call $~lib/as-chain/serializer/Decoder#unpack
              (local.tee $1
               (call $~lib/as-chain/serializer/Decoder#constructor
                (local.get $1)
               )
              )
              (i32.load
               (local.get $0)
              )
             )
             (br $folding-inner4)
            )
            (call $~lib/rt/common/BLOCK#set:mmInfo
             (local.get $0)
             (call $~lib/as-chain/serializer/Decoder#unpackName
              (local.tee $1
               (call $~lib/as-chain/serializer/Decoder#constructor
                (local.get $1)
               )
              )
             )
            )
            (call $~lib/rt/common/OBJECT#set:gcInfo
             (local.get $0)
             (call $~lib/as-chain/serializer/Decoder#unpackName
              (local.get $1)
             )
            )
            (br $folding-inner4)
           )
           (return
            (call $~lib/as-chain/action/Action#unpack
             (local.get $0)
             (local.get $1)
            )
           )
          )
          (call $~lib/as-chain/name/Name#set:N
           (local.get $0)
           (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
            (call $~lib/as-chain/serializer/Decoder#constructor
             (local.get $1)
            )
           )
          )
          (return
           (i32.const 8)
          )
         )
         (call $~lib/as-chain/name/Name#set:N
          (local.get $0)
          (call $~lib/as-chain/serializer/Decoder#unpackNumber<u64>
           (local.tee $1
            (call $~lib/as-chain/serializer/Decoder#constructor
             (local.get $1)
            )
           )
          )
         )
         (call $~lib/as-chain/system/check
          (call $~lib/as-chain/asset/Symbol#isValid
           (local.get $0)
          )
          (i32.const 6176)
         )
         (br $folding-inner4)
        )
        (call $~lib/as-chain/name/Name#set:N
         (local.get $0)
         (call $~lib/as-chain/serializer/Decoder#unpackNumber<i64>
          (local.tee $1
           (call $~lib/as-chain/serializer/Decoder#constructor
            (local.get $1)
           )
          )
         )
        )
        (call $~lib/as-chain/serializer/Decoder#unpack
         (local.get $1)
         (i32.load offset=8
          (local.get $0)
         )
        )
        (call $~lib/as-chain/system/check
         (if (result i32)
          (if (result i32)
           (i64.ge_s
            (i64.load
             (local.get $0)
            )
            (i64.const -4611686018427387903)
           )
           (i64.le_s
            (i64.load
             (local.get $0)
            )
            (i64.const 4611686018427387903)
           )
           (i32.const 0)
          )
          (call $~lib/as-chain/asset/Symbol#isValid
           (i32.load offset=8
            (local.get $0)
           )
          )
          (i32.const 0)
         )
         (i32.const 6224)
        )
        (br $folding-inner4)
       )
       (unreachable)
      )
      (return
       (call $assembly/atomarb.contract/redeemXmdAction#unpack
        (local.get $0)
        (local.get $1)
       )
      )
     )
     (return
      (call $assembly/atomarb.contract/AuthorizedUser#unpack
       (local.get $0)
       (local.get $1)
      )
     )
    )
    (return
     (call $assembly/atomarb.contract/initAction#unpack
      (local.get $0)
      (local.get $1)
     )
    )
   )
   (return
    (call $assembly/atomarb.contract/clearAction#unpack
     (local.get $0)
     (local.get $1)
    )
   )
  )
  (i32.load offset=4
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/arbLegOneAction#pack (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (if
   (i32.eqz
    (i32.load
     (local.get $0)
    )
   )
   (unreachable)
  )
  (if
   (i32.eqz
    (i32.load offset=4
     (local.get $0)
    )
   )
   (unreachable)
  )
  (if
   (i32.eqz
    (i32.load offset=8
     (local.get $0)
    )
   )
   (unreachable)
  )
  (local.set $1
   (i32.add
    (call $~lib/as-chain/utils/Utils.calcPackedStringLength
     (i32.load offset=12
      (local.get $0)
     )
    )
    (i32.const 24)
   )
  )
  (if
   (i32.eqz
    (i32.load offset=16
     (local.get $0)
    )
   )
   (unreachable)
  )
  (local.set $1
   (i32.add
    (local.get $1)
    (i32.const 16)
   )
  )
  (if
   (i32.eqz
    (i32.load offset=20
     (local.get $0)
    )
   )
   (unreachable)
  )
  (local.set $1
   (call $~lib/as-chain/serializer/Encoder#constructor
    (i32.add
     (local.get $1)
     (i32.const 8)
    )
   )
  )
  (if
   (i32.eqz
    (local.tee $2
     (i32.load
      (local.get $0)
     )
    )
   )
   (unreachable)
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (local.get $2)
  )
  (if
   (i32.eqz
    (local.tee $2
     (i32.load offset=4
      (local.get $0)
     )
    )
   )
   (unreachable)
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (local.get $2)
  )
  (if
   (i32.eqz
    (local.tee $2
     (i32.load offset=8
      (local.get $0)
     )
    )
   )
   (unreachable)
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/as-chain/serializer/Encoder#packString
   (local.get $1)
   (i32.load offset=12
    (local.get $0)
   )
  )
  (if
   (i32.eqz
    (local.tee $2
     (i32.load offset=16
      (local.get $0)
     )
    )
   )
   (unreachable)
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (local.get $2)
  )
  (if
   (i32.eqz
    (local.tee $0
     (i32.load offset=20
      (local.get $0)
     )
    )
   )
   (unreachable)
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (local.get $0)
  )
  (call $~lib/as-chain/serializer/Encoder#getBytes
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/arbLegTwoAction#pack (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (if
   (i32.eqz
    (i32.load
     (local.get $0)
    )
   )
   (unreachable)
  )
  (if
   (i32.eqz
    (i32.load offset=4
     (local.get $0)
    )
   )
   (unreachable)
  )
  (local.set $1
   (i32.add
    (call $~lib/as-chain/utils/Utils.calcPackedStringLength
     (i32.load offset=8
      (local.get $0)
     )
    )
    (i32.const 17)
   )
  )
  (if
   (i32.eqz
    (i32.load offset=16
     (local.get $0)
    )
   )
   (unreachable)
  )
  (local.set $1
   (i32.add
    (call $~lib/as-chain/utils/Utils.calcPackedStringLength
     (i32.load offset=20
      (local.get $0)
     )
    )
    (i32.add
     (local.get $1)
     (i32.const 8)
    )
   )
  )
  (if
   (i32.eqz
    (i32.load offset=24
     (local.get $0)
    )
   )
   (unreachable)
  )
  (local.set $1
   (call $~lib/as-chain/serializer/Encoder#constructor
    (i32.add
     (local.get $1)
     (i32.const 16)
    )
   )
  )
  (if
   (i32.eqz
    (local.tee $2
     (i32.load
      (local.get $0)
     )
    )
   )
   (unreachable)
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (local.get $2)
  )
  (if
   (i32.eqz
    (local.tee $2
     (i32.load offset=4
      (local.get $0)
     )
    )
   )
   (unreachable)
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/as-chain/serializer/Encoder#packString
   (local.get $1)
   (i32.load offset=8
    (local.get $0)
   )
  )
  (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
   (local.get $1)
   (i32.load8_u offset=12
    (local.get $0)
   )
  )
  (if
   (i32.eqz
    (local.tee $2
     (i32.load offset=16
      (local.get $0)
     )
    )
   )
   (unreachable)
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (local.get $2)
  )
  (call $~lib/as-chain/serializer/Encoder#packString
   (local.get $1)
   (i32.load offset=20
    (local.get $0)
   )
  )
  (if
   (i32.eqz
    (local.tee $0
     (i32.load offset=24
      (local.get $0)
     )
    )
   )
   (unreachable)
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (local.get $0)
  )
  (call $~lib/as-chain/serializer/Encoder#getBytes
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/redeemXmdAction#pack (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local.set $1
   (call $~lib/as-chain/serializer/Encoder#constructor
    (block (result i32)
     (local.set $1
      (local.get $0)
     )
     (if
      (i32.eqz
       (i32.load
        (local.get $0)
       )
      )
      (unreachable)
     )
     (if
      (i32.eqz
       (i32.load offset=4
        (local.get $1)
       )
      )
      (unreachable)
     )
     (i32.const 24)
    )
   )
  )
  (if
   (i32.eqz
    (local.tee $2
     (i32.load
      (local.get $0)
     )
    )
   )
   (unreachable)
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (local.get $2)
  )
  (if
   (i32.eqz
    (local.tee $0
     (i32.load offset=4
      (local.get $0)
     )
    )
   )
   (unreachable)
  )
  (call $~lib/as-chain/serializer/Encoder#pack
   (local.get $1)
   (local.get $0)
  )
  (call $~lib/as-chain/serializer/Encoder#getBytes
   (local.get $1)
  )
 )
 (func $assembly/atomarb.contract/clearAction#pack (result i32)
  (call $~lib/as-chain/serializer/Encoder#getBytes
   (call $~lib/as-chain/serializer/Encoder#constructor
    (i32.const 0)
   )
  )
 )
 (func $~lib/as-chain/serializer/Packer#pack@virtual (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (block $folding-inner2
   (block $folding-inner1
    (block $folding-inner0
     (block $default
      (block $case42
       (block $case41
        (block $case40
         (block $case39
          (block $case38
           (block $case37
            (block $case36
             (block $case34
              (block $case33
               (block $case31
                (block $case30
                 (block $case29
                  (block $case28
                   (block $case27
                    (block $case26
                     (block $case25
                      (block $case24
                       (block $case23
                        (block $case22
                         (block $case21
                          (block $case20
                           (block $case19
                            (block $case16
                             (block $case15
                              (block $case14
                               (block $case13
                                (block $case11
                                 (block $case10
                                  (block $case9
                                   (block $case8
                                    (block $case7
                                     (block $case6
                                      (block $case5
                                       (block $case4
                                        (block $case3
                                         (block $case2
                                          (block $case1
                                           (block $case0
                                            (br_table $case40 $default $default $default $case7 $default $default $default $default $default $default $default $case8 $default $default $default $case9 $default $default $default $case10 $default $default $default $case4 $default $default $default $case5 $default $default $default $case6 $default $default $default $case11 $default $default $default $default $folding-inner0 $default $default $default $default $default $default $default $default $case37 $case36 $default $default $case13 $case41 $case14 $default $case15 $default $case16 $folding-inner0 $folding-inner0 $case19 $case42 $default $case0 $default $default $default $default $case20 $case1 $default $case38 $default $default $default $case39 $case21 $case22 $case23 $default $case24 $case25 $case26 $case27 $case28 $case2 $default $default $case29 $case3 $default $default $case30 $default $case31 $folding-inner0 $default $case33 $case34 $folding-inner0 $default
                                             (i32.sub
                                              (i32.load
                                               (i32.sub
                                                (local.get $0)
                                                (i32.const 8)
                                               )
                                              )
                                              (i32.const 5)
                                             )
                                            )
                                           )
                                           (drop
                                            (i32.load
                                             (local.get $0)
                                            )
                                           )
                                           (call $~lib/as-chain/serializer/Encoder#pack
                                            (local.tee $1
                                             (call $~lib/as-chain/serializer/Encoder#constructor
                                              (i32.const 16)
                                             )
                                            )
                                            (i32.load
                                             (local.get $0)
                                            )
                                           )
                                           (br $folding-inner1)
                                          )
                                          (return
                                           (call $assembly/atomarb.contract/TransferArgs#pack
                                            (local.get $0)
                                           )
                                          )
                                         )
                                         (return
                                          (call $assembly/atomarb.contract/PlaceOrderArgs#pack
                                           (local.get $0)
                                          )
                                         )
                                        )
                                        (return
                                         (call $assembly/atomarb.contract/WithdrawArgs#pack
                                          (local.get $0)
                                         )
                                        )
                                       )
                                       (return
                                        (call $assembly/atomarb.contract/TokenMap#pack
                                         (local.get $0)
                                        )
                                       )
                                      )
                                      (return
                                       (call $assembly/atomarb.contract/AmmPool#pack
                                        (local.get $0)
                                       )
                                      )
                                     )
                                     (return
                                      (call $assembly/atomarb.contract/DexMarket#pack
                                       (local.get $0)
                                      )
                                     )
                                    )
                                    (return
                                     (call $assembly/atomarb.contract/ArbState#pack
                                      (local.get $0)
                                     )
                                    )
                                   )
                                   (return
                                    (call $assembly/atomarb.contract/Config#pack
                                     (local.get $0)
                                    )
                                   )
                                  )
                                  (return
                                   (call $assembly/atomarb.contract/AuthorizedUser#pack
                                    (local.get $0)
                                   )
                                  )
                                 )
                                 (return
                                  (call $assembly/atomarb.contract/TradeRecord#pack
                                   (local.get $0)
                                  )
                                 )
                                )
                                (drop
                                 (i32.load
                                  (local.get $0)
                                 )
                                )
                                (call $~lib/as-chain/serializer/Encoder#pack
                                 (local.tee $1
                                  (call $~lib/as-chain/serializer/Encoder#constructor
                                   (i32.const 25)
                                  )
                                 )
                                 (i32.load
                                  (local.get $0)
                                 )
                                )
                                (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
                                 (local.get $1)
                                 (i64.load offset=8
                                  (local.get $0)
                                 )
                                )
                                (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
                                 (local.get $1)
                                 (i64.load offset=16
                                  (local.get $0)
                                 )
                                )
                                (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
                                 (local.get $1)
                                 (i32.load8_u offset=24
                                  (local.get $0)
                                 )
                                )
                                (br $folding-inner1)
                               )
                               (local.set $1
                                (call $~lib/as-chain/utils/Utils.calcPackedStringLength
                                 (i32.load
                                  (local.get $0)
                                 )
                                )
                               )
                               (if
                                (i32.eqz
                                 (i32.load offset=4
                                  (local.get $0)
                                 )
                                )
                                (unreachable)
                               )
                               (call $~lib/as-chain/serializer/Encoder#packString
                                (local.tee $1
                                 (call $~lib/as-chain/serializer/Encoder#constructor
                                  (i32.add
                                   (local.get $1)
                                   (i32.const 9)
                                  )
                                 )
                                )
                                (i32.load
                                 (local.get $0)
                                )
                               )
                               (if
                                (i32.eqz
                                 (local.tee $2
                                  (i32.load offset=4
                                   (local.get $0)
                                  )
                                 )
                                )
                                (unreachable)
                               )
                               (call $~lib/as-chain/serializer/Encoder#pack
                                (local.get $1)
                                (local.get $2)
                               )
                               (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
                                (local.get $1)
                                (i32.load8_u offset=8
                                 (local.get $0)
                                )
                               )
                               (br $folding-inner1)
                              )
                              (call $~lib/as-chain/serializer/Encoder#packString
                               (local.tee $1
                                (call $~lib/as-chain/serializer/Encoder#constructor
                                 (i32.add
                                  (i32.add
                                   (i32.add
                                    (call $~lib/as-chain/utils/Utils.calcPackedStringLength
                                     (i32.load
                                      (local.get $0)
                                     )
                                    )
                                    (call $~lib/as-chain/utils/Utils.calcPackedStringLength
                                     (i32.load offset=4
                                      (local.get $0)
                                     )
                                    )
                                   )
                                   (call $~lib/as-chain/utils/Utils.calcPackedStringLength
                                    (i32.load offset=12
                                     (local.get $0)
                                    )
                                   )
                                  )
                                  (i32.const 10)
                                 )
                                )
                               )
                               (i32.load
                                (local.get $0)
                               )
                              )
                              (call $~lib/as-chain/serializer/Encoder#packString
                               (local.get $1)
                               (i32.load offset=4
                                (local.get $0)
                               )
                              )
                              (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
                               (local.get $1)
                               (i32.load8_u offset=8
                                (local.get $0)
                               )
                              )
                              (call $~lib/as-chain/serializer/Encoder#packString
                               (local.get $1)
                               (i32.load offset=12
                                (local.get $0)
                               )
                              )
                              (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
                               (local.get $1)
                               (i32.load8_u offset=16
                                (local.get $0)
                               )
                              )
                              (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
                               (local.get $1)
                               (i64.load offset=24
                                (local.get $0)
                               )
                              )
                              (br $folding-inner1)
                             )
                             (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
                              (local.tee $1
                               (call $~lib/as-chain/serializer/Encoder#constructor
                                (i32.add
                                 (i32.add
                                  (i32.add
                                   (call $~lib/as-chain/utils/Utils.calcPackedStringLength
                                    (i32.load offset=8
                                     (local.get $0)
                                    )
                                   )
                                   (call $~lib/as-chain/utils/Utils.calcPackedStringLength
                                    (i32.load offset=12
                                     (local.get $0)
                                    )
                                   )
                                  )
                                  (call $~lib/as-chain/utils/Utils.calcPackedStringLength
                                   (i32.load offset=20
                                    (local.get $0)
                                   )
                                  )
                                 )
                                 (i32.const 26)
                                )
                               )
                              )
                              (i64.load
                               (local.get $0)
                              )
                             )
                             (call $~lib/as-chain/serializer/Encoder#packString
                              (local.get $1)
                              (i32.load offset=8
                               (local.get $0)
                              )
                             )
                             (call $~lib/as-chain/serializer/Encoder#packString
                              (local.get $1)
                              (i32.load offset=12
                               (local.get $0)
                              )
                             )
                             (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
                              (local.get $1)
                              (i32.load8_u offset=16
                               (local.get $0)
                              )
                             )
                             (call $~lib/as-chain/serializer/Encoder#packString
                              (local.get $1)
                              (i32.load offset=20
                               (local.get $0)
                              )
                             )
                             (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
                              (local.get $1)
                              (i32.load8_u offset=24
                               (local.get $0)
                              )
                             )
                             (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
                              (local.get $1)
                              (i64.load offset=32
                               (local.get $0)
                              )
                             )
                             (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
                              (local.get $1)
                              (i64.load offset=40
                               (local.get $0)
                              )
                             )
                             (br $folding-inner1)
                            )
                            (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
                             (local.tee $1
                              (call $~lib/as-chain/serializer/Encoder#constructor
                               (i32.const 17)
                              )
                             )
                             (i64.load
                              (local.get $0)
                             )
                            )
                            (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
                             (local.get $1)
                             (i64.load offset=8
                              (local.get $0)
                             )
                            )
                            (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
                             (local.get $1)
                             (i32.load8_u offset=16
                              (local.get $0)
                             )
                            )
                            (br $folding-inner1)
                           )
                           (if
                            (i32.eqz
                             (i32.load
                              (local.get $0)
                             )
                            )
                            (unreachable)
                           )
                           (if
                            (i32.eqz
                             (i32.load offset=4
                              (local.get $0)
                             )
                            )
                            (unreachable)
                           )
                           (local.set $1
                            (i32.add
                             (call $~lib/as-chain/utils/Utils.calcPackedStringLength
                              (i32.load offset=8
                               (local.get $0)
                              )
                             )
                             (i32.const 17)
                            )
                           )
                           (if
                            (i32.eqz
                             (i32.load offset=16
                              (local.get $0)
                             )
                            )
                            (unreachable)
                           )
                           (local.set $1
                            (call $~lib/as-chain/serializer/Encoder#constructor
                             (i32.add
                              (local.get $1)
                              (i32.const 16)
                             )
                            )
                           )
                           (if
                            (i32.eqz
                             (local.tee $2
                              (i32.load
                               (local.get $0)
                              )
                             )
                            )
                            (unreachable)
                           )
                           (call $~lib/as-chain/serializer/Encoder#pack
                            (local.get $1)
                            (local.get $2)
                           )
                           (if
                            (i32.eqz
                             (local.tee $2
                              (i32.load offset=4
                               (local.get $0)
                              )
                             )
                            )
                            (unreachable)
                           )
                           (call $~lib/as-chain/serializer/Encoder#pack
                            (local.get $1)
                            (local.get $2)
                           )
                           (call $~lib/as-chain/serializer/Encoder#packString
                            (local.get $1)
                            (i32.load offset=8
                             (local.get $0)
                            )
                           )
                           (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
                            (local.get $1)
                            (i32.load8_u offset=12
                             (local.get $0)
                            )
                           )
                           (if
                            (i32.eqz
                             (local.tee $0
                              (i32.load offset=16
                               (local.get $0)
                              )
                             )
                            )
                            (unreachable)
                           )
                           (call $~lib/as-chain/serializer/Encoder#pack
                            (local.get $1)
                            (local.get $0)
                           )
                           (br $folding-inner2)
                          )
                          (return
                           (call $assembly/atomarb.contract/arbLegOneAction#pack
                            (local.get $0)
                           )
                          )
                         )
                         (return
                          (call $assembly/atomarb.contract/arbLegTwoAction#pack
                           (local.get $0)
                          )
                         )
                        )
                        (if
                         (i32.eqz
                          (i32.load
                           (local.get $0)
                          )
                         )
                         (unreachable)
                        )
                        (if
                         (i32.eqz
                          (i32.load offset=4
                           (local.get $0)
                          )
                         )
                         (unreachable)
                        )
                        (if
                         (i32.eqz
                          (i32.load offset=8
                           (local.get $0)
                          )
                         )
                         (unreachable)
                        )
                        (if
                         (i32.eqz
                          (i32.load offset=12
                           (local.get $0)
                          )
                         )
                         (unreachable)
                        )
                        (local.set $1
                         (call $~lib/as-chain/serializer/Encoder#constructor
                          (i32.add
                           (call $~lib/as-chain/utils/Utils.calcPackedStringLength
                            (i32.load offset=16
                             (local.get $0)
                            )
                           )
                           (i32.const 40)
                          )
                         )
                        )
                        (if
                         (i32.eqz
                          (local.tee $2
                           (i32.load
                            (local.get $0)
                           )
                          )
                         )
                         (unreachable)
                        )
                        (call $~lib/as-chain/serializer/Encoder#pack
                         (local.get $1)
                         (local.get $2)
                        )
                        (if
                         (i32.eqz
                          (local.tee $2
                           (i32.load offset=4
                            (local.get $0)
                           )
                          )
                         )
                         (unreachable)
                        )
                        (call $~lib/as-chain/serializer/Encoder#pack
                         (local.get $1)
                         (local.get $2)
                        )
                        (if
                         (i32.eqz
                          (local.tee $2
                           (i32.load offset=8
                            (local.get $0)
                           )
                          )
                         )
                         (unreachable)
                        )
                        (call $~lib/as-chain/serializer/Encoder#pack
                         (local.get $1)
                         (local.get $2)
                        )
                        (if
                         (i32.eqz
                          (local.tee $2
                           (i32.load offset=12
                            (local.get $0)
                           )
                          )
                         )
                         (unreachable)
                        )
                        (call $~lib/as-chain/serializer/Encoder#pack
                         (local.get $1)
                         (local.get $2)
                        )
                        (call $~lib/as-chain/serializer/Encoder#packString
                         (local.get $1)
                         (i32.load offset=16
                          (local.get $0)
                         )
                        )
                        (br $folding-inner2)
                       )
                       (if
                        (i32.eqz
                         (i32.load
                          (local.get $0)
                         )
                        )
                        (unreachable)
                       )
                       (if
                        (i32.eqz
                         (i32.load offset=4
                          (local.get $0)
                         )
                        )
                        (unreachable)
                       )
                       (if
                        (i32.eqz
                         (i32.load offset=16
                          (local.get $0)
                         )
                        )
                        (unreachable)
                       )
                       (local.set $1
                        (call $~lib/as-chain/serializer/Encoder#constructor
                         (i32.const 48)
                        )
                       )
                       (if
                        (i32.eqz
                         (local.tee $2
                          (i32.load
                           (local.get $0)
                          )
                         )
                        )
                        (unreachable)
                       )
                       (call $~lib/as-chain/serializer/Encoder#pack
                        (local.get $1)
                        (local.get $2)
                       )
                       (if
                        (i32.eqz
                         (local.tee $2
                          (i32.load offset=4
                           (local.get $0)
                          )
                         )
                        )
                        (unreachable)
                       )
                       (call $~lib/as-chain/serializer/Encoder#pack
                        (local.get $1)
                        (local.get $2)
                       )
                       (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
                        (local.get $1)
                        (i64.load offset=8
                         (local.get $0)
                        )
                       )
                       (if
                        (i32.eqz
                         (local.tee $0
                          (i32.load offset=16
                           (local.get $0)
                          )
                         )
                        )
                        (unreachable)
                       )
                       (call $~lib/as-chain/serializer/Encoder#pack
                        (local.get $1)
                        (local.get $0)
                       )
                       (br $folding-inner2)
                      )
                      (if
                       (i32.eqz
                        (i32.load
                         (local.get $0)
                        )
                       )
                       (unreachable)
                      )
                      (if
                       (i32.eqz
                        (i32.load offset=4
                         (local.get $0)
                        )
                       )
                       (unreachable)
                      )
                      (local.set $1
                       (call $~lib/as-chain/serializer/Encoder#constructor
                        (i32.const 32)
                       )
                      )
                      (if
                       (i32.eqz
                        (local.tee $2
                         (i32.load
                          (local.get $0)
                         )
                        )
                       )
                       (unreachable)
                      )
                      (call $~lib/as-chain/serializer/Encoder#pack
                       (local.get $1)
                       (local.get $2)
                      )
                      (if
                       (i32.eqz
                        (local.tee $2
                         (i32.load offset=4
                          (local.get $0)
                         )
                        )
                       )
                       (unreachable)
                      )
                      (call $~lib/as-chain/serializer/Encoder#pack
                       (local.get $1)
                       (local.get $2)
                      )
                      (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
                       (local.get $1)
                       (i64.load offset=8
                        (local.get $0)
                       )
                      )
                      (br $folding-inner1)
                     )
                     (return
                      (call $assembly/atomarb.contract/redeemXmdAction#pack
                       (local.get $0)
                      )
                     )
                    )
                    (if
                     (i32.eqz
                      (i32.load
                       (local.get $0)
                      )
                     )
                     (unreachable)
                    )
                    (if
                     (i32.eqz
                      (i32.load offset=4
                       (local.get $0)
                      )
                     )
                     (unreachable)
                    )
                    (if
                     (i32.eqz
                      (i32.load offset=8
                       (local.get $0)
                      )
                     )
                     (unreachable)
                    )
                    (local.set $1
                     (call $~lib/as-chain/serializer/Encoder#constructor
                      (i32.const 40)
                     )
                    )
                    (if
                     (i32.eqz
                      (local.tee $2
                       (i32.load
                        (local.get $0)
                       )
                      )
                     )
                     (unreachable)
                    )
                    (call $~lib/as-chain/serializer/Encoder#pack
                     (local.get $1)
                     (local.get $2)
                    )
                    (if
                     (i32.eqz
                      (local.tee $2
                       (i32.load offset=4
                        (local.get $0)
                       )
                      )
                     )
                     (unreachable)
                    )
                    (call $~lib/as-chain/serializer/Encoder#pack
                     (local.get $1)
                     (local.get $2)
                    )
                    (if
                     (i32.eqz
                      (local.tee $0
                       (i32.load offset=8
                        (local.get $0)
                       )
                      )
                     )
                     (unreachable)
                    )
                    (call $~lib/as-chain/serializer/Encoder#pack
                     (local.get $1)
                     (local.get $0)
                    )
                    (br $folding-inner2)
                   )
                   (if
                    (i32.eqz
                     (i32.load
                      (local.get $0)
                     )
                    )
                    (unreachable)
                   )
                   (if
                    (i32.eqz
                     (i32.load offset=4
                      (local.get $0)
                     )
                    )
                    (unreachable)
                   )
                   (if
                    (i32.eqz
                     (i32.load offset=8
                      (local.get $0)
                     )
                    )
                    (unreachable)
                   )
                   (local.set $1
                    (call $~lib/as-chain/serializer/Encoder#constructor
                     (i32.const 32)
                    )
                   )
                   (if
                    (i32.eqz
                     (local.tee $2
                      (i32.load
                       (local.get $0)
                      )
                     )
                    )
                    (unreachable)
                   )
                   (call $~lib/as-chain/serializer/Encoder#pack
                    (local.get $1)
                    (local.get $2)
                   )
                   (if
                    (i32.eqz
                     (local.tee $2
                      (i32.load offset=4
                       (local.get $0)
                      )
                     )
                    )
                    (unreachable)
                   )
                   (call $~lib/as-chain/serializer/Encoder#pack
                    (local.get $1)
                    (local.get $2)
                   )
                   (if
                    (i32.eqz
                     (local.tee $0
                      (i32.load offset=8
                       (local.get $0)
                      )
                     )
                    )
                    (unreachable)
                   )
                   (call $~lib/as-chain/serializer/Encoder#pack
                    (local.get $1)
                    (local.get $0)
                   )
                   (br $folding-inner2)
                  )
                  (if
                   (i32.eqz
                    (i32.load
                     (local.get $0)
                    )
                   )
                   (unreachable)
                  )
                  (local.set $1
                   (call $~lib/as-chain/serializer/Encoder#constructor
                    (i32.add
                     (i32.add
                      (call $~lib/as-chain/utils/Utils.calcPackedStringLength
                       (i32.load offset=40
                        (local.get $0)
                       )
                      )
                      (call $~lib/as-chain/utils/Utils.calcPackedStringLength
                       (i32.load offset=48
                        (local.get $0)
                       )
                      )
                     )
                     (i32.const 36)
                    )
                   )
                  )
                  (if
                   (i32.eqz
                    (local.tee $2
                     (i32.load
                      (local.get $0)
                     )
                    )
                   )
                   (unreachable)
                  )
                  (call $~lib/as-chain/serializer/Encoder#pack
                   (local.get $1)
                   (local.get $2)
                  )
                  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
                   (local.get $1)
                   (i64.load offset=8
                    (local.get $0)
                   )
                  )
                  (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
                   (local.get $1)
                   (i32.load8_u offset=16
                    (local.get $0)
                   )
                  )
                  (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
                   (local.get $1)
                   (i32.load8_u offset=17
                    (local.get $0)
                   )
                  )
                  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
                   (local.get $1)
                   (i64.load offset=24
                    (local.get $0)
                   )
                  )
                  (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
                   (local.get $1)
                   (i64.load offset=32
                    (local.get $0)
                   )
                  )
                  (call $~lib/as-chain/serializer/Encoder#packString
                   (local.get $1)
                   (i32.load offset=40
                    (local.get $0)
                   )
                  )
                  (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
                   (local.get $1)
                   (i32.load8_u offset=44
                    (local.get $0)
                   )
                  )
                  (call $~lib/as-chain/serializer/Encoder#packString
                   (local.get $1)
                   (i32.load offset=48
                    (local.get $0)
                   )
                  )
                  (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
                   (local.get $1)
                   (i32.load8_u offset=52
                    (local.get $0)
                   )
                  )
                  (br $folding-inner2)
                 )
                 (return
                  (call $assembly/atomarb.contract/redeemXmdAction#pack
                   (local.get $0)
                  )
                 )
                )
                (if
                 (i32.eqz
                  (i32.load
                   (local.get $0)
                  )
                 )
                 (unreachable)
                )
                (if
                 (i32.eqz
                  (i32.load offset=4
                   (local.get $0)
                  )
                 )
                 (unreachable)
                )
                (local.set $1
                 (call $~lib/as-chain/serializer/Encoder#constructor
                  (i32.add
                   (i32.add
                    (call $~lib/as-chain/utils/Utils.calcPackedStringLength
                     (i32.load offset=8
                      (local.get $0)
                     )
                    )
                    (i32.const 17)
                   )
                   (call $~lib/as-chain/utils/Utils.calcPackedStringLength
                    (i32.load offset=16
                     (local.get $0)
                    )
                   )
                  )
                 )
                )
                (if
                 (i32.eqz
                  (local.tee $2
                   (i32.load
                    (local.get $0)
                   )
                  )
                 )
                 (unreachable)
                )
                (call $~lib/as-chain/serializer/Encoder#pack
                 (local.get $1)
                 (local.get $2)
                )
                (if
                 (i32.eqz
                  (local.tee $2
                   (i32.load offset=4
                    (local.get $0)
                   )
                  )
                 )
                 (unreachable)
                )
                (call $~lib/as-chain/serializer/Encoder#pack
                 (local.get $1)
                 (local.get $2)
                )
                (call $~lib/as-chain/serializer/Encoder#packString
                 (local.get $1)
                 (i32.load offset=8
                  (local.get $0)
                 )
                )
                (call $~lib/as-chain/serializer/Encoder#packNumber<bool>
                 (local.get $1)
                 (i32.load8_u offset=12
                  (local.get $0)
                 )
                )
                (call $~lib/as-chain/serializer/Encoder#packString
                 (local.get $1)
                 (i32.load offset=16
                  (local.get $0)
                 )
                )
                (br $folding-inner2)
               )
               (if
                (i32.eqz
                 (i32.load
                  (local.get $0)
                 )
                )
                (unreachable)
               )
               (local.set $1
                (call $~lib/as-chain/serializer/Encoder#constructor
                 (i32.const 16)
                )
               )
               (if
                (i32.eqz
                 (local.tee $2
                  (i32.load
                   (local.get $0)
                  )
                 )
                )
                (unreachable)
               )
               (call $~lib/as-chain/serializer/Encoder#pack
                (local.get $1)
                (local.get $2)
               )
               (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
                (local.get $1)
                (i64.load offset=8
                 (local.get $0)
                )
               )
               (br $folding-inner1)
              )
              (return
               (call $assembly/atomarb.contract/clearAction#pack)
              )
             )
             (return
              (call $assembly/atomarb.contract/clearAction#pack)
             )
            )
            (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
             (local.tee $1
              (call $~lib/as-chain/serializer/Encoder#constructor
               (i32.const 8)
              )
             )
             (i64.load
              (local.get $0)
             )
            )
            (br $folding-inner1)
           )
           (call $~lib/as-chain/serializer/Encoder#pack
            (local.tee $1
             (call $~lib/as-chain/serializer/Encoder#constructor
              (i32.const 8)
             )
            )
            (i32.load
             (local.get $0)
            )
           )
           (br $folding-inner1)
          )
          (call $~lib/as-chain/serializer/Encoder#packName
           (local.tee $1
            (call $~lib/as-chain/serializer/Encoder#constructor
             (i32.const 16)
            )
           )
           (i32.load
            (local.get $0)
           )
          )
          (call $~lib/as-chain/serializer/Encoder#packName
           (local.get $1)
           (i32.load offset=4
            (local.get $0)
           )
          )
          (br $folding-inner1)
         )
         (return
          (call $~lib/as-chain/action/Action#pack
           (local.get $0)
          )
         )
        )
        (i64.store
         (i32.load offset=4
          (local.tee $1
           (call $~lib/array/Array<u8>#constructor
            (i32.const 8)
           )
          )
         )
         (i64.load
          (local.get $0)
         )
        )
        (return
         (local.get $1)
        )
       )
       (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
        (local.tee $1
         (call $~lib/as-chain/serializer/Encoder#constructor
          (i32.const 8)
         )
        )
        (i64.load
         (local.get $0)
        )
       )
       (br $folding-inner1)
      )
      (call $~lib/as-chain/serializer/Encoder#packNumber<u64>
       (local.tee $1
        (call $~lib/as-chain/serializer/Encoder#constructor
         (i32.const 16)
        )
       )
       (i64.load
        (local.get $0)
       )
      )
      (call $~lib/as-chain/serializer/Encoder#pack
       (local.get $1)
       (i32.load offset=8
        (local.get $0)
       )
      )
      (br $folding-inner1)
     )
     (unreachable)
    )
    (if
     (i32.eqz
      (i32.load
       (local.get $0)
      )
     )
     (unreachable)
    )
    (local.set $1
     (call $~lib/as-chain/serializer/Encoder#constructor
      (i32.const 8)
     )
    )
    (if
     (i32.eqz
      (local.tee $0
       (i32.load
        (local.get $0)
       )
      )
     )
     (unreachable)
    )
    (call $~lib/as-chain/serializer/Encoder#pack
     (local.get $1)
     (local.get $0)
    )
    (br $folding-inner2)
   )
   (return
    (call $~lib/as-chain/serializer/Encoder#getBytes
     (local.get $1)
    )
   )
  )
  (call $~lib/as-chain/serializer/Encoder#getBytes
   (local.get $1)
  )
 )
 (func $~lib/as-chain/idxdb/IDXDB#findPrimaryEx@virtual (param $0 i32) (result i32)
  (drop
   (i32.load
    (i32.sub
     (local.get $0)
     (i32.const 8)
    )
   )
  )
  (unreachable)
 )
 (func $~lib/as-chain/idxdb/IDXDB#storeEx@virtual (param $0 i32) (param $1 i64) (param $2 i32) (param $3 i64)
  (drop
   (i32.load
    (i32.sub
     (local.get $0)
     (i32.const 8)
    )
   )
  )
  (unreachable)
 )
 (func $~lib/as-chain/idxdb/IDXDB#remove@virtual (param $0 i32) (param $1 i32)
  (drop
   (i32.load
    (i32.sub
     (local.get $0)
     (i32.const 8)
    )
   )
  )
  (unreachable)
 )
 (func $~start
  (local $0 i32)
  (global.set $~lib/rt/stub/offset
   (i32.const 6252)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const -5915026983948801152)
  )
  (global.set $assembly/atomarb.contract/AMM_CONTRACT
   (local.get $0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const -1400042389644070944)
  )
  (global.set $assembly/atomarb.contract/TREASURY_CONTRACT
   (local.get $0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.tee $0
    (call $~lib/rt/stub/__new
     (i32.const 8)
     (i32.const 5)
    )
   )
   (i64.const 0)
  )
  (call $~lib/as-chain/name/Name#set:N
   (local.get $0)
   (i64.const 5384616304474849280)
  )
  (global.set $assembly/atomarb.contract/DEX_CONTRACT
   (local.get $0)
  )
 )
)
