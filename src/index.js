import {WebAudioAPI} from "./webAudioAPI";

(function () {
    const audioAPI = new WebAudioAPI();
    const I32_MAX = 2147483647;
    let syncStart = 0;
    let midiDevices = ['---MIDI---'], midiInstruments = [], audioDevices = ['---AUDIO---'];
    let lastRecordedClip = null, recordingInProgress = false, currentDeviceType;
    audioAPI.createTrack('default');
    audioAPI.start();
    const availableEffects = audioAPI.getAvailableEffects();
    const availableMidiNotes = audioAPI.getAvailableNotes();
    const availableNoteDurations = audioAPI.getAvailableNoteDurations();
    audioAPI.getAvailableMidiDevices().then(returnMidiDevice, fail);
    audioAPI.getAvailableAudioInputDevices().then(returnAudioDevice, fail);

    const devRoot = 'http://localhost:8000/extensions/BeatsBlox/instruments/';
    const releaseRoot = 'https://extensions.netsblox.org/extensions/BeatsBlox/instruments/';
    const instrumentLocation = window.origin.includes('localhost') ? devRoot : releaseRoot;

     audioAPI.getAvailableInstruments(instrumentLocation).then(
         instruments => instruments.forEach(
             instrument => midiInstruments.push(instrument)
         )
     );

   
     /**
      * Object representing a mapping between an encoding file type and its unique internal code.
      * @constant {Object.<string, number>}
      */
     const EncodingType = {
         WAV: 1
     };



     /**
      * Object representing a mapping between an effect type and its unique internal code.
      * @constant {Object.<string, number>}
      */
     const EffectType = {
         Reverb: 11, Delay: 12, Echo: 13,                                                 // Time-Based Effects
         Chorus: 21, Tremolo: 22, Vibrato: 23, Flanger: 24, Phaser: 25,                   // Modulation Effects
         Panning: 31, Equalization: 32,                                                   // Spectral Effects
         Volume: 41, Compression: 42, Distortion: 43,                                     // Dynamic Effects
         LowPassFilter: 51, HighPassFilter: 52, BandPassFilter: 53, BandRejectFilter: 54  // Filter Effects
     };

     const EffectsPreset = {
         'Under Water': ['LowPassFilter', {
             ['cutoffFrequency']: 500,
             ['resonance']: 12,
         }],
         'Telephone': ['HighPassFilter', {
             ['cutoffFrequency'] : 1800,
             ['resonance']: 10,
         }],
         'Cave': ['Echo', {
             ['feedback'] : 0.5,
             ['intensity'] : 0.4,
         }],
         'Fan Blade': ['Tremolo', {
             ['tremeloFrequency'] : 18,
         }],
     };

    /**
     * Creates a list of all available MIDI devices
     * @param {[String]} devices - available MIDI device.
     */
    function returnMidiDevice(devices) {
        for (let i = 0; i < devices.length; ++i) 
            midiDevices.push(devices[i] + "---(midi)");
    }  

     /**
      * Creates a list of all available audio-input devices
      * @param {[String]} devices - available audio-input devices.
      */
     function returnAudioDevice(devices) {
         audioDevices = audioDevices.concat(devices);
         console.log(devices);
     }

     /**
      * Runs when the audio API can't return a list of available devices.
      */
     function fail() {
         console.log('something went wrong');
     }

    /**
     * Connects a MIDI device to the WebAudioAPI
     * @param {String} trackName - Name of the Track 
     * @param {String} device - Name of the MIDI device being connected.
     */
    function midiConnect(trackName, device) {
        if (device != "") {
            const mDevice = device.replace("---(midi)", "");
            audioAPI.connectMidiDeviceToTrack(trackName, mDevice).then(() => {
                console.log('Connected to MIDI device!');
            });
            // audioAPI.registerMidiDeviceCallback(device, midiCallback);
            currentDeviceType = 'midi';
        }
    }

     /**
      * Connects and audio input device to NetsBlox
      * @param {String} trackName - Name of the Track 
      * @param {String} device - Name of the audio device being connected.
      */
     function audioConnect(trackName,device) {
         if (device != "") {
             audioAPI.connectAudioInputDeviceToTrack(trackName, device).then(() => {
                 console.log('Connected to audio device!');
             });
             currentDeviceType = 'audio';
         }
     }

     /**
      * Connects an instrument sample to the WebAudioAPI
      * @param {String} trackName - Name of the Track 
      * @param {String} instrument - Name of instrument being loaded.
      */
    async function changeInsturment(trackName,instrument) {
         await audioAPI.updateInstrument(trackName, instrument).then(() => {
             console.log('Instrument loading complete!');
         });
     }

     /**
      * Converts an AudioClip k to a Snap! Sound.
      * @asyn
      * @param {AudioClip} clip - The clip being rendered.
      * @returns A Snap! Sound.
      */
     async function clipToSnap(clip) {
         const blob = await clip.getEncodedData(EncodingType['WAV']);
         const audio = new Audio(URL.createObjectURL(blob, { type: "audio/wav" }));
         return new Sound(audio, 'netsblox-sound');
     }

     /**
      * Disconnects all audio and midi devices from NetsBlox
      * @param {String} trackName - name of the Track 
      * @async
      */
     async function disconnectDevices(trackName) {
         console.log('device disconnected');
         if (audioDevices.length > 0)
             await audioAPI.disconnectAudioInputDeviceFromTrack(trackName);
         if (midiDevices.length > 0)
             await audioAPI.disconnectMidiDeviceFromTrack(trackName);
     }

     function base64toArrayBuffer(base64){
         var binaryString = window.atob(base64.replace("data:audio/mpeg;base64,", ""));
         var bytes = new Uint8Array(binaryString.length);
         for (var i = 0; i < binaryString.length; i++) {
             bytes[i] = binaryString.charCodeAt(i);
         }
         return bytes.buffer;
     }

     async function synchronize(){
         let currentStart = syncStart++;
         await wait(.005);
         do {
             currentStart++;
             await wait(.005);
         } while (currentStart != syncStart);
         audioAPI.start();
     }

    async function playAudio(binaryString, trackName){
        await synchronize();  
        let buffer;
        if (binaryString.audio.src.includes('data:'))
             buffer = base64toArrayBuffer(binaryString.audio.src);
        else 
            buffer = binaryString.audioBuffer;
        audioAPI.start();
        return audioAPI.playClip(trackName, buffer, audioAPI.getCurrentTime(), 0);
    }

     async function playAudioForDuration(binaryString, trackName, dur){
         await synchronize();
         let buffer;
         if (binaryString.audio.src.includes('data:'))
              buffer = base64toArrayBuffer(binaryString.audio.src);
         else 
             buffer = binaryString.audioBuffer;
         audioAPI.start();
         return audioAPI.playClip(trackName, buffer,audioAPI.getCurrentTime(),  dur);
     }

     async function playChord(trackName, listOfNotes, noteDuration){
        for (const note of listOfNotes){
            if(typeof note === "string" && (note in availableMidiNotes)){
                audioAPI.playNote(trackName,availableMidiNotes[note], audioAPI.getCurrentTime(), noteDuration);
            }
            else if(typeof note === 'number'){
                audioAPI.playNote(trackName,note, audioAPI.getCurrentTime(), noteDuration);
            
            }
            else{
                throw Error('Please insert a valid MIDI note(s) name or value e.g C3 or 60');
            }
        }
     }

     async function playScale(trackName, listOfNotes, noteDuration){
        for (const note of listOfNotes){
            await audioAPI.playNote(trackName,note,audioAPI.getCurrentTime(), noteDuration);
        }
   
     }

     async function setTrackPanning(trackName, level){
         const effectOptions = { ["leftToRightRatio"]:Number(level)};
         await audioAPI.applyTrackEffect(trackName,"Panning",availableEffects["Panning"]);
         await audioAPI.updateTrackEffect(trackName,"Panning",effectOptions);
     }

     async function applyTrackEffect(trackName, effectName){
       await audioAPI.applyTrackEffect(trackName,effectName,availableEffects[effectName]);
     
     }


     async function setTrackEffect(trackName, effectName, level){
         const effectType = availableEffects[effectName];
         await audioAPI.applyTrackEffect(trackName,effectName, effectType);
         const parameters = audioAPI.getAvailableEffectParameters(effectType);
         var effectOptions = {};
         for(let i = 0; i < parameters.length; i++){
            console.log(parameters[i].name);
            var parameterValue = parameters[i].name;
            effectOptions[parameterValue] = level;
         }
         console.log(effectOptions);
         await audioAPI.updateTrackEffect(trackName,effectName,effectOptions);
     }

     function createTrack(trackName){
         audioAPI.createTrack(trackName);
     }

     function stopAudio(){
         audioAPI.stop();
         audioAPI.clearAllTracks();
         audioAPI.start();
     }

     async function masterVolume(percent){
         const effectOptions = { ["intensity"]:Number(percent)};
         await audioAPI.updateMasterEffect(trackName,"Volume",effectOptions);
     }
     async function trackVolume(trackName, percent){
         const effectOptions = { ["intensity"]:Number(percent)};
         await audioAPI.updateTrackEffect(trackName,"Volume",effectOptions);
     }
     function  beatsPerMinute(bpm){
         return audioAPI.updateBeatsPerMinute(bpm);
     }
     async function addFxPreset(track, effect) {
         const effectName = EffectsPreset[effect][0];
         await audioAPI.applyTrackEffect(track, effectName, EffectType[effectName]);
         const effectOptions = EffectsPreset[effect][1];
         await audioAPI.updateTrackEffect(track, effectName, effectOptions);
     }

     async function wait(duration) {
         return new Promise(resolve => {
             setTimeout(resolve, duration * 1000);
         })
     }
     // ----------------------------------------------------------------------
     class MusicApp extends Extension {
         constructor(ide) {
             super('MusicApp');
             this.ide = ide;
             const oldStopAllActiveSounds = StageMorph.prototype.runStopScripts;
             StageMorph.prototype.runStopScripts = function(){
                 oldStopAllActiveSounds.call(this);
                 stopAudio();
             };
             this.ide.hideCategory("sound");
         }


         onOpenRole() {
             for (var i =0; i <this.ide.sprites.contents.length; i++){
                createTrack(this.ide.sprites.contents[i].id);
             }
         }

         onNewSprite(sprite){
             createTrack(sprite.id);
         }

         getMenu() { return {}; }

         getCategories() {
             return [
                 new Extension.Category('music', new Color(148,0,211)),
             ];
         }

         getPalette() {
             const blocks = [
                 new Extension.Palette.Block('playAudioClip'),
                 new Extension.Palette.Block('playAudioClipforDuration'),
                 new Extension.Palette.Block('stopClips'),
                 new Extension.Palette.Block('setTrackEffect'),
                 new Extension.Palette.Block('clearTrackEffects'),
                 new Extension.Palette.Block('presetEffect'),
                 new Extension.Palette.Block('setInputDevice'),
                 new Extension.Palette.Block('setInstrument'),
                 new Extension.Palette.Block('startRecordingInput'),
                 new Extension.Palette.Block('recordInputForDuration'),
                 new Extension.Palette.Block('stopRecording'),
                 //new Extension.Palette.Block('exportAudio'),
                 new Extension.Palette.Block('playNote'),
                 new Extension.Palette.Block('scales'),
                 new Extension.Palette.Block('chords'),
                 new Extension.Palette.Block('midiNote'),
                 new Extension.Palette.Block('getLastRecordedClip'),
             ];
             return [
                 new Extension.PaletteCategory('music', blocks, SpriteMorph),
                 new Extension.PaletteCategory('music', blocks, StageMorph),
             ];
         }

         getBlocks() {
             function block(name, type, category, spec, defaults, action) {
                 return new Extension.Block(name, type, category, spec, defaults, action)
             }
             return [
                 block('playAudioClip', 'command', 'music', 'play audio clip %s', ['clip'], function (audioBuffer){
                     this.runAsyncFn(async () =>{
                         const trackName = this.receiver.id;
                         const duration = await playAudio(audioBuffer, trackName);
                         await wait(duration-.02);
                     },{ args: [], timeout: I32_MAX });
                 }),
                 block('playAudioClipforDuration', 'command', 'music', 'play audio clip for duration %n %s', ['1', 'clip'], function (dur,audioBuffer){
                     this.runAsyncFn(async () =>{
                         const trackName = this.receiver.id;
                         const duration = await playAudioForDuration(audioBuffer, trackName, dur);
                         await wait(duration-Math.max(.02,0));
                     },{ args: [], timeout: I32_MAX });
                 }),
                 block('playNote', 'command', 'music', 'play note(s) %s for %noteDurations', ['C3', ''], function (input,noteDuration){
                    console.log(input);
                     this.runAsyncFn(async () =>{
                         const trackName = this.receiver.id;
                         if(input.contents === undefined){
                            if(typeof input === "string" && (input in availableMidiNotes)){
                                const blockduration = await audioAPI.playNote(trackName,availableMidiNotes[input], audioAPI.getCurrentTime(), availableNoteDurations[noteDuration]);
                                await wait(blockduration);
                            }
                            else if(typeof input === 'number'){
                                const blockduration = await audioAPI.playNote(trackName,input, audioAPI.getCurrentTime(), availableNoteDurations[noteDuration]);
                                await wait(blockduration);
                            }
                            else{
                                throw Error('Please insert a valid MIDI note(s) name or value e.g C3 or 60');
                            }
                         }
                         else{
                         if(input.contents.length === 1){
                            const note = input.contents[0];
                            if(typeof note === "string" && (note in availableMidiNotes)){
                                const blockduration = await audioAPI.playNote(trackName,availableMidiNotes[note], audioAPI.getCurrentTime(), availableNoteDurations[noteDuration]);
                                await wait(blockduration);
                            }
                            else if(typeof note === 'number'){
                                const blockduration = await audioAPI.playNote(trackName,note, audioAPI.getCurrentTime(), availableNoteDurations[noteDuration]);
                                await wait(blockduration);
                            }
                            else{
                                throw Error('Please insert a valid MIDI note(s) name or value e.g C3 or 60');
                            }
                        }
                        else if(input.contents.length > 1){
                            const duration = await playChord(trackName, input.contents, availableNoteDurations[noteDuration]);
                            await wait(duration);
                        }
                        // else if(input.contents.length > 5){
                        //     const duration = await playScale(trackName, input.contents, availableNoteDurations[noteDuration]);
                        //     await wait(duration);
                        // }
                    }
                     },{ args: [], timeout: I32_MAX });
                 }),
                 block('stopClips', 'command', 'music', 'stop all clips', [], function (){
                     stopAudio();
                     this.doStopAll();
                 }),
                 block('midiNote', 'reporter', 'music', 'midi note %midiNote', [], function (note){

                    if(note.includes('s')){
                        const startingNote = note.split('s')[0];
                        var startingMidiNumber = availableMidiNotes[startingNote];
                        const reg = new RegExp('s', 'g');
                        const offsetSharp = (note.match(reg)|| []).length
                        return startingMidiNumber + offsetSharp;
                    }
                    else if (note.includes('b')){
                        const startingNote = note.split('b')[0];
                        var startingMidiNumber = availableMidiNotes[startingNote];
                        const reg = new RegExp('b', 'g');
                        const offsetFlat = (note.match(reg)|| []).length
                        return startingMidiNumber + offsetFlat;
                    }
                    return availableMidiNotes[note];

                }),
                 block('scales', 'reporter', 'music', 'scale root note %n type %scaleTypes', ['', 'Major'], function (rootNote, type){
                    if(type === "Major"){
                        const majorScale = [0,2,4,5,7,9,11,12];
                        majorScale.forEach((element,index) => {
                            majorScale[index] = element + rootNote;
                        })

                        return new List(majorScale);
                    }
                    else if (type === "Minor"){
                        const minorScale = [0,2,3,5,7,8,10,12];
                        minorScale.forEach((element,index) => {
                            minorScale[index] = element + rootNote;
                        })
                        return new List(minorScale);
                    }
                    else{
                        throw Error('Please select a valid scale type');
                    }

               }),
               block('chords', 'reporter', 'music', 'chord root note %n type %chordTypes', ['','Major'], function (rootNote, type){
                if(type === "Major"){
                    const majorChord = [0,4,7];
                    majorChord.forEach((element,index) => {
                        majorChord[index] = element + rootNote;
                    })

                    return new List(majorChord);
                }
                else if (type === "Minor"){
                    const minorChord = [0,3,7];
                    minorChord.forEach((element,index) => {
                        minorChord[index] = element + rootNote;
                    })
                    return new List(minorChord);
                }
                else if (type === "Diminished"){
                    const dimChord = [0,3,6];
                    dimChord.forEach((element,index) => {
                        dimChord[index] = element + rootNote;
                    })
                    return new List(dimChord);
                }
                else if (type === "Augmented"){
                    const augChord = [0,4,8];
                    augChord.forEach((element,index) => {
                        augChord[index] = element + rootNote;
                    })
                    return new List(augChord);
                }
                else if (type === "Major 7th"){
                    const major7Chord = [0,4,7,11];
                    major7Chord.forEach((element,index) => {
                        major7Chord[index] = element + rootNote;
                    })
                    return new List(major7Chord);
                }
                else if (type === "Dominant 7th"){
                    const dom7Chord = [0,4,7,10];
                    dom7Chord.forEach((element,index) => {
                        dom7Chord[index] = element + rootNote;
                    })
                    return new List(dom7Chord);
                }
                else if (type === "Minor 7th"){
                    const minor7Chord = [0,3,7,10];
                    minor7Chord.forEach((element,index) => {
                        minor7Chord[index] = element + rootNote;
                    })
                    return new List(minor7Chord);
                }
                else if (type === "Diminished 7th"){
                    const diminished7Chord = [0,3,6,9];
                    diminished7Chord.forEach((element,index) => {
                        diminished7Chord[index] = element + rootNote;
                    })
                    return new List(diminished7Chord);
                }
                else{
                    throw Error( 'Please select a valid chord type');
                }
            }),
            block('setTrackEffect', 'command', 'music','track %supportedEffects effect to %n', ['Volume','1'], function (effectName, level){
                     this.runAsyncFn(async () =>{
                         const trackName = this.receiver.id;
                         await setTrackEffect(trackName, effectName, level);
                     },{ args: [], timeout: I32_MAX });
                 }),
                 block('clearTrackEffects', 'command', 'music','clear track effects', [], function (){
                    this.runAsyncFn(async () =>{
                        const trackName = this.receiver.id;
                        for(const effectName in availableEffects){
                            await audioAPI.removeTrackEffect(trackName,effectName);
                        }
                    },{ args: [], timeout: I32_MAX });
                }),
                 block('presetEffect', 'command', 'music', 'preset effects %fxPreset %onOff', ['', 'on'], function (effect, status) {
                     const trackName = this.receiver.id;
                     if (effect != '') {
                         if (status == 'on') {
                             this.runAsyncFn(async () => {
                                 await addFxPreset(trackName, effect);
                             });
                         } else {
                             const effectName = EffectsPreset[effect][0];
                             this.runAsyncFn(async () => {
                                 await audioAPI.removeTrackEffect(trackName, effectName);
                             });
                         }
                     } else {
                         throw Error('must select an effect');
                     }         
                 }),
                 block('setInputDevice', 'command', 'music', 'set input device: %inputDevice', [''], function (device) {
                     const trackName = this.receiver.id;
                     const isDeviceHeader = (device === '---MIDI---' || device === '---AUDIO---');

                    if (device === '') 
                        this.runAsyncFn(async () => {
                            disconnectDevices(trackName);
                        }, { args: [], timeout: I32_MAX });
                    else if (midiDevices.indexOf(device) != -1)
                        midiConnect(trackName, device);
                    else if (audioDevices.indexOf(device != -1))
                        audioConnect(trackName, device);
                    else
                        throw Error('device not found');

                    if (midiInstruments.length > 0)
                        audioAPI.updateInstrument(trackName, midiInstruments[0]).then(() => {
                            console.log('default instrument set');
                        });
                    else
                        console.log('no default instruments');
                }),
                block('startRecordingInput', 'command', 'music', 'start recording input', [], function () {
                    const trackName = this.receiver.id;
                    switch (currentDeviceType) {
                        case 'midi':
                            lastRecordedClip = audioAPI.recordMidiClip(
                                trackName, audioAPI.getCurrentTime()
                            );
                            break;
                        case 'audio':
                            lastRecordedClip = audioAPI.recordAudioClip(
                                trackName, audioAPI.getCurrentTime()
                            );
                            break;
                    }
                    recordingInProgress = true;
                }),
                block('recordInputForDuration', 'command', 'music', 'record input for %n seconds', [0], function (time) {
                    const trackName = this.receiver.id;
                    switch (currentDeviceType) {
                        case 'midi':
                            lastRecordedClip = audioAPI.recordMidiClip(
                                trackName, audioAPI.getCurrentTime(), time
                            );
                            break;
                        case 'audio':
                            lastRecordedClip = audioAPI.recordAudioClip(
                                trackName, audioAPI.getCurrentTime(), time
                            );
                            break;
                    }
                    recordingInProgress = true;
                }),
                block('startRecording', 'command', 'music', 'start recording master', [], function () {
                    lastRecordedClip = audioAPI.recordOutput();
                    recordingInProgress = true;
                }),
                block('recordForDuration', 'command', 'music', 'record master for %n seconds', [0], function (time) {
                    lastRecordedClip = audioAPI.recordOutput(null, null, time);
                    recordingInProgress = true;
                }),
                block('setInstrument', 'command', 'music', 'set instrument %webMidiInstrument', ['Grand Piano'], function(instrument) {
                    const trackName = this.receiver.id;
                    this.runAsyncFn(async () => {
                        await changeInsturment(trackName,instrument);
                    }, { args: [], timeout: I32_MAX });
                }),
                block('stopRecording', 'command', 'music', 'stop recording', [], function() {
                    this.runAsyncFn(async () => {
                        await lastRecordedClip.finalize();
                    }, { args: [], timeout: I32_MAX });
                    recordingInProgress = false;
                }),
                // block('exportAudio', 'command', 'music', 'export %s as %fileFormats', ['clip'], function (clip, format) {
                //     this.runAsyncFn(async () => {
                //         await exportClip(clip, format);
                //     }, { args: [], timeout: I32_MAX });
                // }),
                block('getLastRecordedClip', 'reporter', 'music', 'get last recorded clip', [], function () {
                    if (recordingInProgress)
                        throw Error('recording in progress');
                    else if (lastRecordedClip == null)
                        throw Error('no clip found');
                    else {
                        return this.runAsyncFn(async () => {
                            let temp = await clipToSnap(lastRecordedClip);
                            temp.audioBuffer = await lastRecordedClip.getEncodedData(EncodingType['WAV']);
                            return temp;
                        }, { args: [], timeout: I32_MAX });
                    }
                        // return this.runAsyncFn(async () => {
                        //     return await clipToSnap(lastRecordedClip);
                        // }, { args: [], timeout: I32_MAX });
                }),
            ];
        }
        getLabelParts() { 
            function identityMap(s) {
                const res = {};
                for (const x of s) res[x] = x;
                return res;
            }
            function unionMaps(maps) {
                const res = {};
                for (const map of maps) {
                    for (const key in map) res[key] = map[key];
                }
                return res;
            }
            return [
            new Extension.LabelPart('bpmNotes', () => new InputSlotMorph(
                null, //text
                false, // numeric
                unionMaps([
                    identityMap([ 'Whole', 'Half', 'Quarter', 'Eighth', 'Sixteenth', 'Thirtysecondth']),
                ]),
                true,
            )),
            new Extension.LabelPart('enabled', () => new InputSlotMorph(
                null, //text
                false, //numeric
                unionMaps([
                    identityMap(['Enabled', 'Disabled']),
                ]),
                true,
            )),
            new Extension.LabelPart('effects', () => new InputSlotMorph(
                null, //text
                false, //numeric
                identityMap(Object.keys(availableEffects)),
                true, //readonly (no arbitrary text)
            )),
            new Extension.LabelPart('supportedEffects', () => new InputSlotMorph(
                null, //text
                false, //numeric
                identityMap(['Volume', 'Delay', 'Reverb', 'Echo', 'Panning']),
                true, //readonly (no arbitrary text)
            )),
            new Extension.LabelPart('midiNotes', () => new InputSlotMorph(
                null, //text
                false, //numeric
                identityMap(Object.keys(availableMidiNotes)),
                false, //readonly (no arbitrary text)
            )),
            new Extension.LabelPart('midiNote', () => new InputSlotMorph(
               null, //text
               false, //numeric
               {
                   'C':{
                       '0': identityMap(['C0','C0s','C0b']),
                       '1': identityMap(['C1','C1s','C1b']),
                       '2': identityMap(['C2','C2s','C2b']),
                       '3': identityMap(['C3','C3s','C3b']),
                       '4': identityMap(['C4','C4s','C4b']),
                       '5': identityMap(['C5','C5s','C5b']),
                       '6': identityMap(['C6','C6s','C6b']),
                       '7': identityMap(['C7','C7s','C7b']),
                       '8': identityMap(['C8','C8s','C8b']),
                       '9': identityMap(['C9','C9s','C9b']),
                   },
                   'D':{
                       '0': identityMap(['D0','D0s','D0b']),
                       '1': identityMap(['D1','D1s','D1b']),
                       '2': identityMap(['D2','D2s','D2b']),
                       '3': identityMap(['D3','D3s','D3b']),
                       '4': identityMap(['D4','D4s','D4b']),
                       '5': identityMap(['D5','D5s','D5b']),
                       '6': identityMap(['D6','D6s','D6b']),
                       '7': identityMap(['D7','D7s','D7b']),
                       '8': identityMap(['D8','D8s','D8b']),
                       '9': identityMap(['D9','D9s','D9b']),
                   },
                   'E':{
                       '0': identityMap(['E0','E0s','E0b']),
                       '1': identityMap(['E1','E1s','E1b']),
                       '2': identityMap(['E2','E2s','E2b']),
                       '3': identityMap(['E3','E3s','E3b']),
                       '4': identityMap(['E4','E4s','E4b']),
                       '5': identityMap(['E5','E5s','E5b']),
                       '6': identityMap(['E6','E6s','E6b']),
                       '7': identityMap(['E7','E7s','E7b']),
                       '8': identityMap(['E8','E8s','E8b']),
                       '9': identityMap(['E9','E9s','E9b']),
                   },
                   'F':{
                       '0': identityMap(['F0','F0s','F0b']),
                       '1': identityMap(['F1','F1s','F1b']),
                       '2': identityMap(['F2','F2s','F2b']),
                       '3': identityMap(['F3','F3s','F3b']),
                       '4': identityMap(['F4','F4s','F4b']),
                       '5': identityMap(['F5','F5s','F5b']),
                       '6': identityMap(['F6','F6s','F6b']),
                       '7': identityMap(['F7','F7s','F7b']),
                       '8': identityMap(['F8','F8s','F8b']),
                       '9': identityMap(['F9','F9s','F9b']),
                   },
                   'G':{
                       '0': identityMap(['G0','G0s','G0b']),
                       '1': identityMap(['G1','G1s','G1b']),
                       '2': identityMap(['G2','G2s','G2b']),
                       '3': identityMap(['G3','G3s','G3b']),
                       '4': identityMap(['G4','G4s','G4b']),
                       '5': identityMap(['G5','G5s','G5b']),
                       '6': identityMap(['G6','G6s','G6b']),
                       '7': identityMap(['G7','G7s','G7b']),
                       '8': identityMap(['G8','G8s','G8b']),
                       '9': identityMap(['G9','G9s','G9b']),
                   },
                   'A':{
                       '0': identityMap(['A0','A0s','A0b']),
                       '1': identityMap(['A1','A1s','A1b']),
                       '2': identityMap(['A2','A2s','A2b']),
                       '3': identityMap(['A3','A3s','A3b']),
                       '4': identityMap(['A4','A4s','A4b']),
                       '5': identityMap(['A5','A5s','A5b']),
                       '6': identityMap(['A6','A6s','A6b']),
                       '7': identityMap(['A7','A7s','A7b']),
                       '8': identityMap(['A8','A8s','A8b']),
                       '9': identityMap(['A9','A9s','A9b']),
                   },
                   'B':{
                       '0': identityMap(['B0','B0s','B0b']),
                       '1': identityMap(['B1','B1s','B1b']),
                       '2': identityMap(['B2','B2s','B2b']),
                       '3': identityMap(['B3','B3s','B3b']),
                       '4': identityMap(['B4','B4s','B4b']),
                       '5': identityMap(['B5','B5s','B5b']),
                       '6': identityMap(['B6','B6s','B6b']),
                       '7': identityMap(['B7','B7s','B7b']),
                       '8': identityMap(['B8','B8s','B8b']),
                       '9': identityMap(['B9','B9s','B9b']),
                   },

               },
               true, //readonly (no arbitrary text)
           )),
            new Extension.LabelPart('noteDurations', () => new InputSlotMorph(
                null, //text
                false, //numeric
                identityMap(Object.keys(availableNoteDurations)),
                false, //readonly (no arbitrary text)
            )),
             new Extension.LabelPart('chordTypes', () => new InputSlotMorph(
                null, //text
                false, //numeric
                identityMap(['Major', 'Minor', 'Diminished', 'Augmented', 'Major 7th', 'Dominant 7th', 'Minor 7th', 'Diminished 7th']),
                true, //readonly (no arbitrary text)
            )),
            new Extension.LabelPart('scaleTypes', () => new InputSlotMorph(
                null, //text
                false, //numeric
                identityMap(['Major', 'Minor']),
                true, //readonly (no arbitrary text)
            )),
             new Extension.LabelPart('fxPreset', () => new InputSlotMorph(
                 null, // text
                 false, //numeric
                 identityMap(['Under Water', 'Telephone', 'Cave', 'Fan Blade']),
                 true, // readonly (no arbitrary text)
             )),
             new Extension.LabelPart('onOff', () => new InputSlotMorph(
                 null, // text
                 false, //numeric
                 identityMap(['on', 'off']),
                 true, // readonly (no arbitrary text)
             )),
             new Extension.LabelPart('webMidiInstrument', () => new InputSlotMorph(
                 null, // text
                 false, //numeric
                 identityMap(midiInstruments),
                 true, // readonly (no arbitrary text)
             )),
             new Extension.LabelPart('fileFormats', () => new InputSlotMorph(
                 null, // text
                 false, //numeric
                 identityMap(['WAV']),
                 true, // readonly (no arbitrary text)
             )),
             new Extension.LabelPart('inputDevice', () => new InputSlotMorph(
                 null, // text
                 false, //numeric
                 identityMap(midiDevices.concat(audioDevices)),
                 true, // readonly (no arbitrary text)
             )),
         ];           
     }

     }
     var element = document.createElement('link');
    element.setAttribute('rel', 'stylesheet');
    element.setAttribute('type', 'text/css');
    element.setAttribute('href', 'https://gsteinltu.github.io/PseudoMorphic/style.css');
    document.head.appendChild(element);

    var scriptElement = document.createElement('script');

    scriptElement.onload = () => {
       var element = createDialog('MusicApp');
       // const canvas = document.createElement('canvas');
       // canvas.id = 'roboscape-canvas';
       // element.querySelector('content').appendChild(canvas);
         element.querySelector('content').innerHTML = 
                     '<div id="waveform"></div><script type="module">import WaveSurfer from \'https://unpkg.com/wavesurfer.js@beta\' const wavesurfer = WaveSurfer.create({container: \'#waveform\', waveColor: \'violet\', progressColor: \'purple\'});      wavesurfer.once(\'interaction\', () => {wavesurfer.play()})</script>';
         setupDialog(element);
       window.externalVariables['musicAppDialog'] = element;
    };
    scriptElement.setAttribute('src', 'https://gsteinltu.github.io/PseudoMorphic/script.js');
    document.head.appendChild(scriptElement);

     NetsBloxExtensions.register(MusicApp);
 })();
