import React from 'react';
import FileManager from "../lib/FileManager";
import ServerManager from "../lib/ServerManager";
import Utils from "../lib/Utils";
import Button from "./Button"

export default class Home extends React.Component {

  constructor(props) {
    super(props);

    let inputKey = props.location.hash.slice(1, props.location.hash.length);
    this.state = {userKey: inputKey, inputKey: inputKey};

    let token = props.match.params.token;
    ServerManager.get().getBundleInfo(token).then((response) => {
      this.setState({urls: response.urls, token: token});
    }).catch((error) => {
      console.error("Get bundle info exception:", error);
      this.setState({bundleError: error});
    })
  }

  onKeyChange = (event) => {
    this.setState({userKey: event.target.value});
  }

  flashError(error) {
    this.setState({status: error, statusClass: "danger"});
    setTimeout(() => {
      this.setState({status: null, statusClass: null});
    }, 2500);
  }

  downloadFiles = async (event) => {
    if(event) {
      event.preventDefault();
    }

    this.setState({status: "Downloading...", downloading: true, decryptionError: false, processingError: null});

    await Utils.sleep(250);

    if(this.state.userKey.length == 0) {
      this.setState({status: null, downloading: false, processingError: {message: "Encryption key not set."}});
      return;
    }

    // Download files
    let files = await ServerManager.get().downloadFileUrls(this.state.urls).catch((error) => {
      console.error("Download file urls failed:", error);
      return null;
    })

    if(!files) {
      this.setState({status: null, downloading: false, processingError: {message: "An error occurred while trying to download files. Please try again."}});
      return;
    }

    // Decrypt Files
    this.setState({status: "Decrypting..."});
    await Utils.sleep(250);

    let authParamsData = await SFJS.crypto.base64Decode(SFJS.itemTransformer.encryptionComponentsFromString(files[0].content).authParams);
    let authParams = JSON.parse(authParamsData);
    let keyToUse;
    if(this.state.userKey != this.state.inputKey) {
      // Process it if it's user inputted text
      keyToUse = await Utils.processUserInputtedKey(this.state.userKey);
    } else {
      keyToUse = this.state.inputKey;
    }
    let keys = await SFJS.crypto.computeEncryptionKeysForUser(keyToUse, authParams);

    let decryptedFiles = [];
    Promise.all(files.map((file) => {
      return new Promise((resolve, reject) => {
        FileManager.get().decryptFile(file, keys).then(({data, item}) => {
          ServerManager.get().successfulDownload(this.state.token, item.content.deletionToken).then((response) => {
            Utils.downloadData(data, item.content.fileName, item.content.fileType);
            this.setState({downloaded: true, downloading: false, decryptionError: false, status: null});
            resolve();
          })
        }).catch((decryptionError) => {
          this.flashError("Error decrypting file.");
          this.setState({decryptionError: true, downloading: false, status: null});
          reject(decryptionError);
        })
      })
    }))
  }

  render() {
    return (
      <div id="download">
        {!this.state.bundleError && !this.state.downloaded &&
          <div className="sk-panel-row">
            <div className="sk-panel-column stretch">
              {!this.state.urls && !this.state.bundleError &&
                <div className="sk-panel-row centered first-and-only">
                  <div className="sk-label">Loading files...</div>
                </div>
              }

              {this.state.urls && !this.state.downloaded &&
                <div>
                  <div className="sk-h2">
                    Downloading <span className="sk-bold">{this.state.urls.length}</span> {Utils.pluralize("file", "s", this.state.urls.length)}.
                  </div>

                  <div className="file-info">
                    Files and file names have been encrypted by the sender.
                    Please enter the decryption key below.
                    Your files will be download, then decrypted securely in your browser.
                  </div>

                  <div className="sk-panel-row">
                    <div className="sk-panel-column stretch">
                      <input className="sk-panel-row sk-input info" type="text" placeholder="Encryption key" value={this.state.userKey} onChange={this.onKeyChange} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"/>
                      {this.state.decryptionError &&
                        <div className="danger sk-bold">
                          The decryption key you entered is incorrect. Please try again.
                        </div>
                      }

                      {this.state.processingError &&
                        <div className="sk-panel-row danger sk-bold">
                          {this.state.processingError.message}
                        </div>
                      }
                    </div>
                  </div>


                  {!this.state.downloading &&
                    <Button className="sk-panel-row" label="Download" onClick={this.downloadFiles} />
                  }
                </div>
              }

            </div>
          </div>
        }

        {this.state.bundleError &&
          <div className="sk-panel-row centered first-and-only">
            {this.state.bundleError.message}
          </div>
        }

        {this.state.downloaded &&
          <div className="sk-panel-row centered sk-bold first-and-only">
            <div>Your {Utils.chooseNounGrouping("file has", "files have", this.state.urls.length)} been downloaded.</div>
          </div>
        }

        {this.state.status &&
          <div className="sk-panel-row centered sk-bold">
            {this.state.status}
          </div>
        }
      </div>
    )
  }

}
