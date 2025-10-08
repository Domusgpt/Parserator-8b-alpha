import { ParseratorProfile, ParseratorProfileConfig, ParseratorProfileContext, ParseratorProfileOption } from './types';
export interface ResolvedProfile extends ParseratorProfileConfig {
    profile: ParseratorProfile;
}
export declare function listParseratorProfiles(): ParseratorProfile[];
export declare function resolveProfile(option: ParseratorProfileOption | undefined, context: ParseratorProfileContext): ResolvedProfile | undefined;
export declare function getProfileByName(name: string): ParseratorProfile | undefined;
//# sourceMappingURL=profiles.d.ts.map